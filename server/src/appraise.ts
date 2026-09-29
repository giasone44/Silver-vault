import { AiError } from "./ai.js";
import { priceGuide, numistaEnabled } from "./numista.js";
import type { Comp, Item, MarketResearch } from "./schemas.js";

// Free appraisal: no paid AI. Combines live melt value, Numista price-guide
// values for the piece's year / mint / grade, and eBay prices when an eBay
// developer key is configured. Sources are listed in the report.

const JUNK = /\b(lot|roll|rolls|set of|replica|copy|copies|plated|clad|tribute|album|capsules?|holders?|tubes?|coin flip|\d+\s*(?:x|pcs|pieces|coins))\b|\bx\s*\d+\b/i;

function quantile(sorted: number[], q: number) {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
}

/** eBay results that plausibly are this exact single piece, outliers trimmed. */
function relevant(item: Item, comps: Comp[], melt: number | null): Comp[] {
  const year = item.year?.match(/\d{4}/)?.[0];
  let out = comps.filter((c) => !JUNK.test(c.title) && (!year || c.title.includes(year)));
  if (melt) out = out.filter((c) => c.price_usd >= melt * 0.8);
  if (out.length >= 4) {
    const sorted = out.map((c) => c.price_usd).sort((a, b) => a - b);
    const med = quantile(sorted, 0.5);
    out = out.filter((c) => c.price_usd <= med * 2.5);
  }
  return out;
}

const round = (n: number) => Math.round(n * 100) / 100;

export async function freeAppraisal(
  item: Item,
  ctx: { spot: number | null; melt: number | null; ebay: Comp[] },
): Promise<MarketResearch> {
  const { melt } = ctx;
  const pricing_model = item.category === "bullion" ? "bullion" : "numismatic";
  const guide = numistaEnabled() ? await priceGuide(item).catch(() => null) : null;
  const ebay = relevant(item, ctx.ebay, melt);
  const sold = ebay.filter((c) => c.kind === "sold").map((c) => c.price_usd).sort((a, b) => a - b);
  const asking = ebay.filter((c) => c.kind === "asking").map((c) => c.price_usd).sort((a, b) => a - b);
  const floor = melt ?? 0;
  const sources: string[] = [];
  let estimate: number, low: number, high: number;
  let confidence: MarketResearch["confidence"] = "low";

  if (sold.length >= 3) {
    estimate = quantile(sold, 0.5);
    low = quantile(sold, 0.25);
    high = quantile(sold, 0.75);
    confidence = sold.length >= 8 ? "high" : "medium";
    sources.push(`the median of ${sold.length} recent eBay sales`);
  } else if (guide && pricing_model === "numismatic") {
    estimate = guide.price;
    low = guide.low;
    high = guide.high;
    confidence = "medium";
    sources.push("the Numista price guide for this year, mint and grade");
  } else if (asking.length >= 3) {
    // Asking prices run above what things actually sell for; shade them down.
    estimate = quantile(asking, 0.5) * 0.92;
    low = quantile(asking, 0.25) * 0.9;
    high = quantile(asking, 0.5);
    sources.push(`${asking.length} current eBay asking prices, discounted about 8% because listings sell below ask`);
  } else if (guide) {
    estimate = guide.price;
    low = guide.low;
    high = guide.high;
    sources.push("the Numista price guide");
  } else if (melt != null) {
    estimate = melt;
    low = melt;
    high = melt * 1.08;
    sources.push("melt value at live spot (no catalogue or marketplace prices available)");
  } else {
    throw new AiError(
      "Not enough information to value this piece. Add its weight and fineness (for melt value), or pick its catalogue entry when adding it.",
    );
  }

  // Precious metal never sensibly trades below its melt value.
  estimate = Math.max(estimate, floor);
  low = Math.max(Math.min(low, estimate), floor * 0.97);
  high = Math.max(high, estimate);

  const comps = [...ebay.filter((c) => c.kind === "sold"), ...(guide?.comps ?? []), ...ebay.filter((c) => c.kind === "asking")].slice(0, 25);
  const premium = melt ? ((estimate - melt) / melt) * 100 : null;
  const summary =
    `Based on ${sources.join(" and ")}.` +
    (melt ? ` Melt value is $${melt.toFixed(2)}${premium != null && premium > 0.5 ? `, so this carries a ${premium.toFixed(0)}% premium over its metal` : ""}.` : "") +
    (confidence === "low" ? " Treat this as a rough guide; a paid appraisal or recent sold listings would firm it up." : "");

  return {
    pricing_model,
    estimated_value_usd: round(estimate),
    low_usd: round(low),
    high_usd: round(high),
    dealer_buy_usd: null,
    dealer_sell_usd: null,
    confidence,
    comps,
    summary,
    selling_tips: null,
  };
}
