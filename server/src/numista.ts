import { config } from "./config.js";
import type { Comp, Item, ItemInput } from "./schemas.js";

// Numista (numista.com) is a free, community-maintained catalogue of coins and
// bullion with exact specifications, mintages by year and mint, and price
// estimates by grade. API key: numista.com/api (free).

const BASE = "https://api.numista.com/v3";
const GRAMS_PER_TROY_OZ = 31.1034768;

export function numistaEnabled() {
  return Boolean(config.numistaKey);
}

async function get(path: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ lang: "en", ...params });
  const res = await fetch(`${BASE}${path}?${qs}`, {
    headers: { "Numista-API-Key": config.numistaKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401) throw new Error("Numista rejected the API key - check NUMISTA_API_KEY in your settings.");
  if (!res.ok) throw new Error(`Numista ${path} -> HTTP ${res.status}`);
  return res.json() as Promise<any>;
}

export type CatalogHit = {
  id: number;
  title: string;
  issuer: string | null;
  years: string | null;
  category: string;
  thumbnail: string | null;
};

export async function searchCatalog(q: string, category?: "coin" | "exonumia"): Promise<CatalogHit[]> {
  const j = await get("/types", { q, count: "12", ...(category ? { category } : {}) });
  return (j.types ?? []).map((t: any): CatalogHit => ({
    id: t.id,
    title: t.title,
    issuer: t.issuer?.name ?? null,
    years: t.min_year ? (t.max_year && t.max_year !== t.min_year ? `${t.min_year}–${t.max_year}` : String(t.min_year)) : null,
    category: t.category,
    thumbnail: t.obverse_thumbnail ?? null,
  }));
}

/** "Silver (.999)", "Silver 900‰", "Gold (999.9/1000)" -> 0.999 / 0.9 / 0.9999 */
export function parseFineness(text: string | undefined): number | null {
  if (!text) return null;
  const m = text.match(/(0?\.\d{3,4})|(\d{3}(?:\.\d)?)\s*(?:‰|\/1000)|\b(9\d{2}(?:\.\d)?)\b/);
  if (!m) return null;
  if (m[1]) return Number(m[1]);
  return Number(m[2] ?? m[3]) / 1000;
}

function metalOf(text: string | undefined): ItemInput["metal"] | null {
  const t = (text ?? "").toLowerCase();
  if (t.includes("platinum")) return "platinum";
  if (t.includes("palladium")) return "palladium";
  if (t.includes("gold")) return "gold";
  if (t.includes("silver")) return "silver";
  if (t.includes("copper") || t.includes("bronze")) return "copper";
  return null;
}

/** Catalogue specifications mapped onto item fields; only known values are returned. */
export type CatalogSpecs = Partial<ItemInput> & {
  numista_id: number;
  catalog_title: string;
  catalog_url: string | null;
  weight_grams: number | null;
  diameter_mm: number | null;
  thickness_mm: number | null;
  obverse_description: string | null;
  reverse_description: string | null;
  edge: string | null;
  designer: string | null;
  mints: string[];
  /** Mintage of the issue matching the given year / mint mark, if known. */
  mintage: number | null;
  issues: CatalogIssue[];
};

export type CatalogIssue = { id: number; year: number | null; mint_letter: string | null; mintage: number | null; comment: string | null };

export async function catalogIssues(id: number): Promise<CatalogIssue[]> {
  const issues = (await get(`/types/${id}/issues`)) as any[];
  return issues.map((i) => ({
    id: i.id,
    year: i.gregorian_year ?? i.year ?? null,
    mint_letter: i.mint_letter || null,
    mintage: typeof i.mintage === "number" ? i.mintage : null,
    comment: i.comment ?? null,
  }));
}

/** The issue matching a year and mint mark (a blank mark matches issues without one). */
export function findIssue(issues: CatalogIssue[], year: string | number | null | undefined, mintMark: string | null | undefined) {
  const y = year ? Number(String(year).match(/\d{4}/)?.[0]) : null;
  const mark = (mintMark ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  const sameYear = issues.filter((i) => !y || i.year === y);
  return sameYear.find((i) => (i.mint_letter ?? "").toUpperCase() === mark) ?? (y ? sameYear[0] : undefined) ?? null;
}

export async function catalogSpecs(id: number, at?: { year?: string | null; mintMark?: string | null }): Promise<CatalogSpecs> {
  const [t, issues] = await Promise.all([get(`/types/${id}`), catalogIssues(id).catch(() => [] as CatalogIssue[])]);
  const issue = at?.year ? findIssue(issues, at.year, at.mintMark) : null;
  const purity = parseFineness(t.composition?.text);
  const grams: number | null = typeof t.weight === "number" ? t.weight : null;
  const gross = grams != null ? grams / GRAMS_PER_TROY_OZ : null;
  const ref = (t.references ?? []).find((r: any) => r.catalogue?.code === "KM") ?? t.references?.[0];
  const specs: CatalogSpecs = {
    numista_id: t.id,
    catalog_title: t.title,
    catalog_url: t.url ?? null,
    weight_grams: grams,
    diameter_mm: typeof t.size === "number" ? t.size : null,
    thickness_mm: typeof t.thickness === "number" ? t.thickness : null,
    obverse_description: t.obverse?.description ?? null,
    reverse_description: t.reverse?.description ?? null,
    edge: t.edge?.description ?? null,
    designer: [...(t.obverse?.engravers ?? []), ...(t.reverse?.engravers ?? [])].join(", ") || null,
    mints: (t.mints ?? []).map((m: any) => m.name),
    mintage: issue?.mintage ?? null,
    issues,
  };
  const set = <K extends keyof ItemInput>(k: K, v: ItemInput[K] | null | undefined) => {
    if (v != null && v !== "") (specs as any)[k] = v;
  };
  set("country", t.issuer?.name);
  set("denomination", t.value?.text);
  set("series", t.series);
  set("catalog_number", ref ? `${ref.catalogue?.code ?? ""}# ${ref.number}`.trim() : null);
  set("metal", metalOf(t.composition?.text));
  set("purity", purity);
  set("gross_weight_troy_oz", gross != null ? Number(gross.toFixed(4)) : null);
  set("fine_weight_troy_oz", gross != null && purity != null ? Number((gross * purity).toFixed(4)) : null);
  if (t.category === "coin") set("item_type", "coin");
  return specs;
}

/** Numista grade keys, low to high. */
const GRADES = ["g", "vg", "f", "vf", "xf", "au", "unc"] as const;
const GRADE_LABEL: Record<string, string> = { g: "G", vg: "VG", f: "F", vf: "VF", xf: "XF", au: "AU", unc: "UNC" };

function gradeKey(grade: string | null | undefined): (typeof GRADES)[number] {
  const g = (grade ?? "").toUpperCase();
  if (/MS|UNC|BU|PR|PF|PROOF|GEM/.test(g)) return "unc";
  if (/AU/.test(g)) return "au";
  if (/XF|EF/.test(g)) return "xf";
  if (/VF/.test(g)) return "vf";
  if (/VG/.test(g)) return "vg";
  if (/\bF\b|FINE/.test(g)) return "f";
  if (/\bG\b|GOOD/.test(g)) return "g";
  return "unc"; // bullion and unlabelled pieces are typically uncirculated
}

/** Price-guide values for this piece's year / mint mark, keyed to its grade. */
export async function priceGuide(item: Item): Promise<{ price: number; low: number; high: number; comps: Comp[] } | null> {
  if (!item.numista_id) return null;
  const issue = findIssue(await catalogIssues(item.numista_id), item.year, item.mint_mark);
  if (!issue) return null;

  const j = await get(`/types/${item.numista_id}/issues/${issue.id}/prices`, { currency: "USD" });
  const prices = new Map<string, number>((j.prices ?? []).map((p: any) => [p.grade, Number(p.price)]));
  if (!prices.size) return null;

  const key = gradeKey(item.certification_grade ?? item.grade);
  const idx = GRADES.indexOf(key);
  const at = (i: number) => prices.get(GRADES[Math.max(0, Math.min(GRADES.length - 1, i))]);
  const price = at(idx) ?? [...prices.values()].at(-1)!;
  const url = `https://en.numista.com/catalogue/pieces${item.numista_id}.html`;
  const comps: Comp[] = GRADES.filter((g) => prices.has(g)).map((g) => ({
    title: `${item.name} · ${GRADE_LABEL[g]}${issue.year ? ` · ${issue.year}${issue.mint_letter ? `-${issue.mint_letter}` : ""}` : ""}`,
    price_usd: prices.get(g)!,
    date: null,
    source: "Numista price guide",
    url,
    kind: "price_guide",
  }));
  return { price, low: at(idx - 1) ?? price * 0.85, high: at(idx + 1) ?? price * 1.15, comps };
}
