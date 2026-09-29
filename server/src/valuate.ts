import { config } from "./config.js";
import { researchMarket } from "./ai.js";
import { freeAppraisal } from "./appraise.js";
import { getItem, listItems, setValuation } from "./db.js";
import { ebayComps } from "./ebay.js";
import type { Item, Valuation } from "./schemas.js";
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
      ? await researchMarket(item, { spot, melt, ebay })
      : await freeAppraisal(item, { spot, melt, ebay });
  const valuation: Valuation = {
    ...research,
    valued_at: new Date().toISOString(),
    spot_at_valuation: spot,
    melt_at_valuation: melt,
    model: config.aiProvider === "claude" ? config.claudeModel : "free: melt + catalogue + marketplace",
  };
  setValuation(id, valuation);
  return getItem(id)!;
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
