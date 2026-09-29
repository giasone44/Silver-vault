import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Category, Identification, ItemInput, ItemType, Metal } from "../lib/types";
import { Chip, Field, SectionTitle } from "./ui";

export function emptyInput(): ItemInput {
  return {
    name: "", item_type: "round", category: "bullion", metal: "silver", purity: 0.999,
    gross_weight_troy_oz: 1, fine_weight_troy_oz: null, year: null, mint: null, mint_mark: null, country: null,
    denomination: null, series: null, catalog_number: null, certification_service: "none",
    certification_grade: null, cert_number: null, grade: null, condition_notes: null, quantity: 1,
    purchase_price_per_unit: null, purchase_date: null, purchase_source: null, storage_location: null,
    tags: [], notes: null, search_query: null, specs: null,
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
    if (k === "specs") continue;
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

export function ItemForm({ form }: { form: ReturnType<typeof useItemDraft> }) {
  const { draft, set } = form;
  const f = (k: keyof ItemInput, label: string, extra: object = {}) => (
    <Field label={label} value={draft[k]} onChangeText={(v) => set(k, v)} {...extra} />
  );
  const num = { keyboardType: "decimal-pad" as const };
  const pick = <T extends string>(k: keyof ItemInput, options: [T, string][]) => (
    <View style={styles.chips}>
      {options.map(([v, label]) => <Chip key={v} label={label} active={draft[k] === v} onPress={() => set(k, v)} />)}
    </View>
  );

  return (
    <View>
      {f("name", "Name")}
      <SectionTitle>Type</SectionTitle>
      {pick<ItemType>("item_type", [["coin", "Coin"], ["round", "Round"], ["bar", "Bar"], ["other", "Other"]])}
      <View style={{ height: 8 }} />
      {pick<Category>("category", [["bullion", "Bullion"], ["semi-numismatic", "Semi-numismatic"], ["numismatic", "Numismatic"]])}
      <View style={{ height: 8 }} />
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
      <View style={{ height: 10 }} />
      {f("condition_notes", "Condition notes", { multiline: true })}

      <SectionTitle>Ownership</SectionTitle>
      <View style={styles.grid}>
        {f("quantity", "Quantity", { keyboardType: "number-pad" })}
        {f("purchase_price_per_unit", "Paid per unit ($)", num)}
        {f("purchase_date", "Purchase date (YYYY-MM-DD)")}
        {f("purchase_source", "Bought from")}
        {f("storage_location", "Storage location")}
        {f("tags", "Tags (comma separated)")}
      </View>
      <View style={{ height: 10 }} />
      {f("search_query", "Market search query")}
      <Text style={styles.help}>Used to look up recent sales. Include year, mint mark and grade.</Text>
      <View style={{ height: 10 }} />
      {f("notes", "Notes", { multiline: true })}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  help: { color: "#8B93A1", fontSize: 11, marginTop: 4 },
});
