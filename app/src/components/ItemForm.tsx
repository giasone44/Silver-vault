import { useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, hairline, type } from "../lib/theme";
import type { CatalogSpecs, Category, Identification, ItemInput, ItemType, Metal } from "../lib/types";
import { PressableScale } from "./motion";
import { Field, Segmented, SectionTitle } from "./ui";

export function emptyInput(): ItemInput {
  return {
    name: "", item_type: "round", category: "bullion", metal: "silver", purity: 0.999,
    gross_weight_troy_oz: 1, fine_weight_troy_oz: null, year: null, mint: null, mint_mark: null, country: null,
    denomination: null, series: null, catalog_number: null, certification_service: "none",
    certification_grade: null, cert_number: null, grade: null, condition_notes: null, quantity: 1,
    purchase_price_per_unit: null, purchase_date: null, purchase_source: null, storage_location: null,
    tags: [], notes: null, search_query: null, numista_id: null, specs: null,
  };
}

export function inputFromIdentification(id: Identification, base: ItemInput = emptyInput()): ItemInput {
  return {
    ...base,
    name: id.name,
    item_type: id.item_type,
    category: id.category,
    metal: id.metal,
    purity: id.purity,
    gross_weight_troy_oz: id.gross_weight_troy_oz,
    fine_weight_troy_oz: id.fine_weight_troy_oz,
    year: id.year,
    mint: id.mint,
    mint_mark: id.mint_mark,
    country: id.country,
    denomination: id.denomination,
    series: id.series,
    catalog_number: id.catalog_number,
    certification_service: id.certification_service,
    certification_grade: id.certification_grade,
    cert_number: id.cert_number,
    grade: id.certification_grade ?? id.estimated_grade,
    condition_notes: id.condition_notes,
    search_query: id.search_query,
    specs: id,
  };
}

function blankIdentification(v: ItemInput): Identification {
  return {
    name: v.name, item_type: v.item_type, category: v.category, metal: v.metal, purity: v.purity,
    gross_weight_troy_oz: v.gross_weight_troy_oz, fine_weight_troy_oz: v.fine_weight_troy_oz, weight_grams: null,
    diameter_mm: null, thickness_mm: null, country: v.country, mint: v.mint, mint_mark: v.mint_mark, year: v.year,
    denomination: v.denomination, series: v.series, catalog_number: v.catalog_number, mintage: null, designer: null,
    obverse_description: "", reverse_description: "", edge: null, certification_service: v.certification_service ?? "none",
    certification_grade: v.certification_grade, cert_number: v.cert_number, estimated_grade: v.grade,
    condition_notes: v.condition_notes, variety_or_error: null, search_query: v.search_query ?? v.name,
    confidence: 1, notes_for_user: null,
  };
}

/**
 * Applies catalogue specifications. What was read from the photos (year, mint
 * mark, grade, condition) is kept; physical specs come from the catalogue.
 */
export function inputWithCatalog(v: ItemInput, c: CatalogSpecs): ItemInput {
  const { numista_id, catalog_title, catalog_url, weight_grams, diameter_mm, thickness_mm, obverse_description,
    reverse_description, edge, designer, mints, mintage, issues, ...fields } = c;
  const specs = v.specs ?? blankIdentification(v);
  return {
    ...v,
    ...fields,
    name: v.name || catalog_title,
    mint: v.mint ?? (mints.length === 1 ? mints[0] : null),
    numista_id,
    specs: {
      ...specs,
      weight_grams: weight_grams ?? specs.weight_grams,
      diameter_mm: diameter_mm ?? specs.diameter_mm,
      thickness_mm: thickness_mm ?? specs.thickness_mm,
      obverse_description: specs.obverse_description || obverse_description || "",
      reverse_description: specs.reverse_description || reverse_description || "",
      edge: edge ?? specs.edge,
      designer: designer ?? specs.designer,
      mintage: mintage != null ? mintage.toLocaleString("en-US") : specs.mintage,
    },
  };
}

// Numbers are edited as text so partially typed values like "0." survive.
type Draft = Record<keyof ItemInput, string>;
const NUMERIC = ["purity", "gross_weight_troy_oz", "fine_weight_troy_oz", "quantity", "purchase_price_per_unit"] as const;

function toDraft(v: ItemInput): Draft {
  const d = {} as Draft;
  for (const [k, val] of Object.entries(v)) {
    d[k as keyof ItemInput] = k === "tags" ? (val as string[]).join(", ") : val == null || typeof val === "object" ? "" : String(val);
  }
  return d;
}

export function fromDraft(d: Draft, base: ItemInput): ItemInput {
  const out: any = { ...base };
  for (const [k, raw] of Object.entries(d)) {
    if (k === "specs" || k === "numista_id") continue;
    const s = raw.trim();
    if (k === "tags") out.tags = s ? s.split(",").map((t) => t.trim()).filter(Boolean) : [];
    else if ((NUMERIC as readonly string[]).includes(k)) {
      const n = parseFloat(s.replace(/[$,]/g, ""));
      out[k] = Number.isFinite(n) ? n : null;
    } else out[k] = s || null;
  }
  out.quantity = Math.max(1, Math.round(out.quantity ?? 1));
  out.name = out.name ?? "";
  return out as ItemInput;
}

export function useItemDraft(initial: ItemInput) {
  const [base, setBase] = useState(initial);
  const [draft, setDraft] = useState(() => toDraft(initial));
  return {
    draft,
    set: (k: keyof ItemInput, v: string) => setDraft((d) => ({ ...d, [k]: v })),
    reset: (v: ItemInput) => {
      setBase(v);
      setDraft(toDraft(v));
    },
    value: () => fromDraft(draft, base),
  };
}

/**
 * Your own details (price paid, quantity…) come first. The identified details
 * follow; with `collapsible` they start folded away behind one tap, since the
 * app fills them in and they usually need no changes.
 */
export function ItemForm({ form, collapsible, catalog }: {
  form: ReturnType<typeof useItemDraft>;
  collapsible?: boolean;
  /** Rendered at the top of the identified details (e.g. the catalogue picker). */
  catalog?: ReactNode;
}) {
  const { draft, set } = form;
  const [open, setOpen] = useState(!collapsible);
  const f = (k: keyof ItemInput, label: string, extra: object = {}) => (
    <Field label={label} value={draft[k]} onChangeText={(v) => set(k, v)} {...extra} />
  );
  const num = { keyboardType: "decimal-pad" as const };
  const pick = <T extends string>(k: keyof ItemInput, options: [T, string][]) => (
    <Segmented options={options} value={draft[k] as T} onChange={(v) => set(k, v)} />
  );

  return (
    <View>
      <SectionTitle>Your details</SectionTitle>
      <Text style={[styles.help, { marginTop: -4, marginBottom: 14 }]}>Optional: fill in what you know.</Text>
      <View style={styles.grid}>
        {f("purchase_price_per_unit", "Paid per piece ($)", num)}
        {f("quantity", "How many", { keyboardType: "number-pad" })}
        {f("purchase_date", "Date bought (YYYY-MM-DD)")}
        {f("purchase_source", "Bought from")}
        {f("storage_location", "Kept at")}
        {f("tags", "Tags (comma separated)")}
      </View>
      <View style={{ height: 18 }} />
      {f("notes", "Notes", { multiline: true })}

      {collapsible && (
        <PressableScale onPress={() => setOpen((o) => !o)} style={styles.toggle}>
          <View style={{ flex: 1 }}>
            <Text style={type.labelGold}>Identified details</Text>
            <Text style={[styles.help, { marginTop: 3 }]}>
              {draft.name || "Unnamed"}{draft.year ? ` · ${draft.year}` : ""}{draft.mint ? ` · ${draft.mint}` : ""}
            </Text>
          </View>
          <Text style={[type.labelGold, { fontSize: 9 }]}>{open ? "Hide" : "Review"}</Text>
        </PressableScale>
      )}
      {open && (
        <View>
      {catalog}
      {f("name", "Name")}
      <SectionTitle>Type</SectionTitle>
      {pick<ItemType>("item_type", [["coin", "Coin"], ["round", "Round"], ["bar", "Bar"], ["other", "Other"]])}
      <View style={{ height: 10 }} />
      {pick<Category>("category", [["bullion", "Bullion"], ["semi-numismatic", "Semi-numismatic"], ["numismatic", "Numismatic"]])}
      <View style={{ height: 10 }} />
      {pick<Metal>("metal", [["silver", "Silver"], ["gold", "Gold"], ["platinum", "Platinum"], ["palladium", "Palladium"], ["copper", "Copper"], ["other", "Other"]])}

      <SectionTitle>Metal content</SectionTitle>
      <View style={styles.grid}>
        {f("purity", "Purity (e.g. 0.999)", num)}
        {f("gross_weight_troy_oz", "Gross weight (troy oz)", num)}
        {f("fine_weight_troy_oz", "Fine weight (troy oz)", num)}
      </View>

      <SectionTitle>Details</SectionTitle>
      <View style={styles.grid}>
        {f("year", "Year")}
        {f("mint", "Mint / refiner")}
        {f("mint_mark", "Mint mark")}
        {f("country", "Country")}
        {f("denomination", "Denomination")}
        {f("series", "Series")}
        {f("catalog_number", "Catalog # (KM)")}
      </View>

      <SectionTitle>Grade & certification</SectionTitle>
      <View style={styles.grid}>
        {f("certification_service", "Service (none/PCGS/NGC)")}
        {f("certification_grade", "Slab grade")}
        {f("cert_number", "Cert #")}
        {f("grade", "Grade / condition")}
      </View>
      <View style={{ height: 18 }} />
      {f("condition_notes", "Condition notes", { multiline: true })}

      <View style={{ height: 18 }} />
      {f("search_query", "Market search query")}
      <Text style={styles.help}>Used to look up recent sales. Include year, mint mark and grade.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", columnGap: 18, rowGap: 18 },
  help: { fontFamily: fonts.serifItalic, color: colors.muted, fontSize: 13, marginTop: 6 },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 30,
    paddingVertical: 14,
    borderTopWidth: hairline,
    borderBottomWidth: hairline,
    borderColor: colors.hairlineStrong,
  },
});
