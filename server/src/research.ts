import fs from "node:fs";
import path from "node:path";
import { identify, researchDossier } from "./ai.js";
import { config } from "./config.js";
import * as db from "./db.js";
import { matchMaker } from "./makers.js";
import { catalogSpecs, numistaEnabled, searchCatalog, type CatalogSpecs } from "./numista.js";
import { ollamaIdentify } from "./ollama.js";
import type { Dossier, Identification, Item, ItemInput } from "./schemas.js";
import { valuateItem } from "./valuate.js";

// Background research: after a piece is saved (or re-identified) the server
// builds its reference file and market valuation without the phone waiting.

const queue: string[] = [];
let running = false;

export function queueResearch(id: string) {
  if (!queue.includes(id)) queue.push(id);
  db.setResearchStatus(id, "queued");
  void drain();
}

/** Resume anything that was interrupted by a restart. */
export function resumeResearch() {
  for (const item of db.listItems()) {
    if (item.research_status === "queued" || item.research_status === "running") queueResearch(item.id);
  }
}

async function drain() {
  if (running) return;
  running = true;
  while (queue.length) {
    const id = queue.shift()!;
    if (!db.getItem(id)) continue;
    db.setResearchStatus(id, "running");
    try {
      await research(id);
      db.setResearchStatus(id, "done");
    } catch (err) {
      console.error(`research ${id} failed:`, err);
      db.setResearchStatus(id, "failed", err instanceof Error ? err.message : String(err));
    }
  }
  running = false;
}

async function research(id: string) {
  const item = db.getItem(id)!;
  if (config.aiProvider === "claude") {
    const dossier = await researchDossier(item, matchMaker(item.mint, item.name));
    db.setDossier(id, dossier);
    db.updateItem(id, withDossier(item, dossier));
  }
  await valuateItem(id);
}

const inputOf = (item: Item): ItemInput => {
  const { id, obverse_photo, reverse_photo, valuation, dossier, research_status, research_error, created_at, updated_at, ...input } = item;
  return input;
};

/** Fills gaps in the record from the researched file; never overwrites what's already there. */
function withDossier(item: Item, d: Dossier): ItemInput {
  const v = inputOf(item);
  const s = d.specifications;
  return {
    ...v,
    purity: v.purity ?? s.purity,
    gross_weight_troy_oz: v.gross_weight_troy_oz ?? s.gross_weight_troy_oz,
    fine_weight_troy_oz: v.fine_weight_troy_oz ?? s.fine_weight_troy_oz,
    specs: v.specs && {
      ...v.specs,
      weight_grams: v.specs.weight_grams ?? s.weight_grams,
      diameter_mm: v.specs.diameter_mm ?? s.diameter_mm,
      thickness_mm: v.specs.thickness_mm ?? s.thickness_mm,
      edge: v.specs.edge ?? s.edge,
      designer: v.specs.designer ?? d.designer,
      mintage: v.specs.mintage ?? d.mintage,
      obverse_description: v.specs.obverse_description || d.obverse_design,
      reverse_description: v.specs.reverse_description || d.reverse_design,
    },
  };
}

/** Physical specs from the catalogue; what was read from the photos (year, mint mark, grade) is kept. */
function withCatalog(v: ItemInput, c: CatalogSpecs): ItemInput {
  const { numista_id, catalog_title, catalog_url, weight_grams, diameter_mm, thickness_mm, obverse_description,
    reverse_description, edge, designer, mints, mintage, issues, ...fields } = c;
  return {
    ...v,
    ...fields,
    numista_id,
    specs: v.specs && {
      ...v.specs,
      weight_grams: weight_grams ?? v.specs.weight_grams,
      diameter_mm: diameter_mm ?? v.specs.diameter_mm,
      thickness_mm: thickness_mm ?? v.specs.thickness_mm,
      edge: edge ?? v.specs.edge,
      designer: designer ?? v.specs.designer,
      mintage: mintage != null ? mintage.toLocaleString("en-US") : v.specs.mintage,
      obverse_description: v.specs.obverse_description || obverse_description || "",
      reverse_description: v.specs.reverse_description || reverse_description || "",
    },
  };
}

function readPhoto(file: string | null) {
  if (!file) return null;
  const full = path.join(config.dataDir, "photos", path.basename(file));
  if (!fs.existsSync(full)) return null;
  const ext = path.extname(file).toLowerCase();
  const mediaType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return { base64: fs.readFileSync(full).toString("base64"), mediaType } as const;
}

/**
 * Reads a saved piece's photos again from scratch, refreshes everything the
 * photos and catalogue can tell us, keeps the owner's own details (price paid,
 * quantity, notes, location), then re-researches it.
 */
export async function reidentify(id: string): Promise<Item> {
  const item = db.getItem(id);
  if (!item) throw new Error("Item not found");
  const obverse = readPhoto(item.obverse_photo) ?? readPhoto(item.reverse_photo);
  if (!obverse) throw new Error("This piece has no photos to read. Tap Amend to add them.");
  const reverse = item.obverse_photo && item.reverse_photo ? readPhoto(item.reverse_photo) : null;

  const ident: Identification =
    config.aiProvider === "claude" ? await identify(obverse, reverse) : await ollamaIdentify(obverse, reverse);
  const maker = matchMaker(ident.mint, ident.name, ident.search_query);
  if (maker) ident.mint = maker.name;

  const own = inputOf(item);
  let next: ItemInput = {
    ...own,
    name: ident.name,
    item_type: ident.item_type,
    category: ident.category,
    metal: ident.metal,
    purity: ident.purity,
    gross_weight_troy_oz: ident.gross_weight_troy_oz,
    fine_weight_troy_oz: ident.fine_weight_troy_oz,
    year: ident.year,
    mint: ident.mint,
    mint_mark: ident.mint_mark,
    country: ident.country,
    denomination: ident.denomination,
    series: ident.series,
    catalog_number: ident.catalog_number,
    certification_service: ident.certification_service,
    certification_grade: ident.certification_grade,
    cert_number: ident.cert_number,
    grade: ident.certification_grade ?? ident.estimated_grade,
    condition_notes: ident.condition_notes,
    search_query: ident.search_query,
    numista_id: null,
    specs: ident,
  };

  if (numistaEnabled()) {
    const category = ident.item_type === "coin" ? "coin" : "exonumia";
    const top = (await searchCatalog(ident.search_query, category).catch(() => []))[0];
    if (top) {
      const specs = await catalogSpecs(top.id, { year: next.year, mintMark: next.mint_mark }).catch(() => null);
      if (specs) next = withCatalog(next, specs);
    }
  }

  db.updateItem(id, next);
  queueResearch(id);
  return db.getItem(id)!;
}
