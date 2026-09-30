import { config } from "./config.js";
import { recordProblem } from "./diagnostics.js";
import { researchMarket } from "./ai.js";
import { freeAppraisal } from "./appraise.js";
import { matchMaker } from "./makers.js";
import { numistaEnabled, priceGuide } from "./numista.js";
import { getItem, listItems, setValuation } from "./db.js";
import { ebayComps } from "./ebay.js";
import type { Item, MarketResearch, Valuation } from "./schemas.js";
import { getSpot, spotFor } from "./spot.js";

export function fineOz(item: Pick<Item, "fine_weight_troy_oz" | "gross_weight_troy_oz" | "purity">): number | null {
  if (item.fine_weight_troy_oz != null) return item.fine_weight_troy_oz;
  if (item.gross_weight_troy_oz != null && item.purity != null) return item.gross_weight_troy_oz * item.purity;
  return null;
}

export async function valuateItem(id: string): Promise<Item> {
  const item = getItem(id);
  if (!item) throw new Error("Item not found");

  const spotQuote = await getSpot().catch(() => null);
  const spot = spotQuote ? spotFor(spotQuote, item.metal) : null;
  const oz = fineOz(item);
  const melt = spot != null && oz != null ? spot * oz : null;

  const query = item.search_query ?? item.specs?.search_query ?? item.name;
  const { comps: ebay } = await ebayComps(query);

  const research =
    config.aiProvider === "claude"
      ? await researchMarket(item, {
          spot,
          melt,
          ebay,
          guide: numistaEnabled() ? await priceGuide(item).catch(() => null) : null,
          maker: matchMaker(item.mint, item.name),
        })
      : await freeAppraisal(item, { spot, melt, ebay });
  const valuation: Valuation = {
    ...checkAgainstSales(research, melt),
    valued_at: new Date().toISOString(),
    spot_at_valuation: spot,
    melt_at_valuation: melt,
    model: config.aiProvider === "claude" ? `${config.claudeModel} · ${SALES_CHECKED}` : "free: melt + catalogue + marketplace",
  };
  setValuation(id, valuation);
  return getItem(id)!;
}

/**
 * Safety net: the value must agree with the actual sales found. If it sits well
 * below the median sold price (typically melt, for a collectible round or bar),
 * the sold prices win.
 */
export function checkAgainstSales(r: MarketResearch, melt: number | null): MarketResearch {
  const sold = r.comps
    .filter((c) => (c.kind === "sold" || c.kind === "auction") && c.price_usd > 0)
    .map((c) => c.price_usd)
    .sort((a, b) => a - b);
  if (sold.length < 2) return r;
  const median = sold.length % 2 ? sold[(sold.length - 1) / 2] : (sold[sold.length / 2 - 1] + sold[sold.length / 2]) / 2;
  if (r.estimated_value_usd >= median * 0.85) return r;
  const premium = melt != null && median > melt * 1.1;
  return {
    ...r,
    pricing_model: premium ? "numismatic" : r.pricing_model,
    estimated_value_usd: Math.round(median * 100) / 100,
    low_usd: Math.min(r.low_usd, sold[0]),
    high_usd: Math.max(r.high_usd, sold[sold.length - 1]),
    summary: `${r.summary} Value set to the median of ${sold.length} recent sales ($${median.toFixed(2)}).`,
  };
}

// --- Background bulk revaluation -------------------------------------------

const queue: string[] = [];
let running = false;
export const revalueStatus = { queued: 0, current: null as string | null, done: 0, failed: 0 };

async function drain() {
  if (running) return;
  running = true;
  while (queue.length) {
    const id = queue.shift()!;
    revalueStatus.queued = queue.length;
    revalueStatus.current = id;
    try {
      await valuateItem(id);
      revalueStatus.done++;
    } catch (err) {
      revalueStatus.failed++;
      console.error(`revalue ${id} failed:`, err);
      recordProblem("Market refresh", `Market refresh for ${getItem(id)?.name ?? "a piece"} didn't finish.`, err);
    }
  }
  revalueStatus.current = null;
  running = false;
}

/** Queue items whose valuation is older than `staleHours` (or all given ids). */
export function queueRevalue(opts: { ids?: string[]; staleHours?: number }): number {
  const cutoff = Date.now() - (opts.staleHours ?? 24) * 3600_000;
  const ids = opts.ids?.length
    ? opts.ids
    : listItems()
        .filter((i) => !i.valuation || Date.parse(i.valuation.valued_at) < cutoff)
        .map((i) => i.id);
  for (const id of ids) if (!queue.includes(id) && revalueStatus.current !== id) queue.push(id);
  revalueStatus.queued = queue.length;
  void drain();
  return ids.length;
}

/** Marks valuations made with the sold-price rules and safety check. */
const SALES_CHECKED = "sold-price check";

/**
 * Valuations made before the sold-price rules may have settled on melt for
 * collectible pieces. Research those again, once.
 */
export function recheckMeltValuations(): number {
  if (config.aiProvider !== "claude") return 0;
  const ids = listItems()
    .filter((i) => i.valuation && !i.valuation.model.includes(SALES_CHECKED))
    .map((i) => i.id);
  return ids.length ? queueRevalue({ ids }) : 0;
}

/** Re-research every piece's sold prices once a week, so values follow the market. */
const REFRESH_DAYS = 7;
export function scheduleMarketRefresh() {
  if (config.aiProvider !== "claude") return;
  const run = () => {
    const n = queueRevalue({ staleHours: REFRESH_DAYS * 24 });
    if (n) console.log(`Weekly market refresh: re-researching ${n} piece(s).`);
  };
  setTimeout(run, 10 * 60_000).unref();
  setInterval(run, 6 * 3600_000).unref();
}
