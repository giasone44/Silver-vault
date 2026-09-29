import type { Item, SpotQuote } from "./types";

export function fineOz(item: Pick<Item, "fine_weight_troy_oz" | "gross_weight_troy_oz" | "purity">): number | null {
  if (item.fine_weight_troy_oz != null) return item.fine_weight_troy_oz;
  if (item.gross_weight_troy_oz != null && item.purity != null) return item.gross_weight_troy_oz * item.purity;
  return null;
}

export function spotFor(quote: SpotQuote | null, metal: string): number | null {
  if (!quote) return null;
  return metal === "silver" || metal === "gold" || metal === "platinum" || metal === "palladium" ? quote[metal] : null;
}

export type LiveValue = {
  melt: number | null;
  /** Current value of one unit. */
  unit: number | null;
  total: number | null;
  cost: number | null;
  gain: number | null;
  gainPct: number | null;
  premiumPct: number | null;
  source: "market" | "melt" | "none";
};

/**
 * Bullion valuations float with spot: the premium found at research time is
 * kept and melt is re-priced live. Numismatic valuations are held fixed until
 * the next market refresh.
 */
export function liveValue(item: Item, quote: SpotQuote | null): LiveValue {
  const spot = spotFor(quote, item.metal);
  const ozs = fineOz(item);
  const melt = spot != null && ozs != null ? spot * ozs : null;
  const v = item.valuation;
  let unit: number | null = melt;
  let source: LiveValue["source"] = melt != null ? "melt" : "none";
  if (v) {
    source = "market";
    unit =
      v.pricing_model === "bullion" && spot != null && v.spot_at_valuation != null && ozs != null
        ? v.estimated_value_usd + (spot - v.spot_at_valuation) * ozs
        : v.estimated_value_usd;
  }
  const total = unit != null ? unit * item.quantity : null;
  const cost = item.purchase_price_per_unit != null ? item.purchase_price_per_unit * item.quantity : null;
  const gain = total != null && cost != null ? total - cost : null;
  return {
    melt,
    unit,
    total,
    cost,
    gain,
    gainPct: gain != null && cost ? (gain / cost) * 100 : null,
    premiumPct: unit != null && melt ? ((unit - melt) / melt) * 100 : null,
    source,
  };
}

export function portfolioTotals(items: Item[], quote: SpotQuote | null) {
  let value = 0, melt = 0, cost = 0, silverOz = 0, goldOz = 0, pieces = 0;
  for (const item of items) {
    const lv = liveValue(item, quote);
    value += lv.total ?? 0;
    melt += (lv.melt ?? 0) * item.quantity;
    cost += lv.cost ?? 0;
    pieces += item.quantity;
    const ozs = (fineOz(item) ?? 0) * item.quantity;
    if (item.metal === "silver") silverOz += ozs;
    if (item.metal === "gold") goldOz += ozs;
  }
  return { value, melt, cost, gain: value - cost, silverOz, goldOz, pieces };
}
