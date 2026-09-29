import { config } from "./config.js";
import type { Comp } from "./schemas.js";

// eBay APIs:
//  - Browse API (any developer account): current listings -> "asking" comps.
//  - Marketplace Insights API (requires eBay approval): actual sold prices, last 90 days.

let token: { value: string; expires: number } | null = null;

export function ebayEnabled() {
  return Boolean(config.ebayClientId && config.ebayClientSecret);
}

async function getToken(): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const scopes = ["https://api.ebay.com/oauth/api_scope"];
  if (config.ebayInsights) scopes.push("https://api.ebay.com/oauth/api_scope/buy.marketplace.insights");
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${config.ebayClientId}:${config.ebayClientSecret}`).toString("base64"),
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: scopes.join(" ") }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`eBay OAuth failed: HTTP ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, expires: Date.now() + j.expires_in * 1000 };
  return token.value;
}

async function ebayGet(url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${await getToken()}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`eBay ${new URL(url).pathname} -> HTTP ${res.status}`);
  return res.json() as Promise<any>;
}

async function soldComps(q: string): Promise<Comp[]> {
  const j = await ebayGet(
    `https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search?q=${encodeURIComponent(q)}&limit=25`,
  );
  return (j.itemSales ?? []).map(
    (s: any): Comp => ({
      title: s.title,
      price_usd: Number(s.lastSoldPrice?.value ?? s.price?.value),
      date: s.lastSoldDate ?? null,
      source: "eBay",
      url: s.itemWebUrl ?? null,
      kind: "sold",
    }),
  );
}

async function activeListings(q: string): Promise<Comp[]> {
  const j = await ebayGet(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&limit=25&filter=buyingOptions:{FIXED_PRICE},priceCurrency:USD`,
  );
  return (j.itemSummaries ?? []).map(
    (s: any): Comp => ({
      title: s.title,
      price_usd: Number(s.price?.value),
      date: s.itemCreationDate ?? null,
      source: "eBay",
      url: s.itemWebUrl ?? null,
      kind: "asking",
    }),
  );
}

/** Best-effort: returns whatever eBay data is available, never throws. */
export async function ebayComps(q: string): Promise<{ comps: Comp[]; errors: string[] }> {
  if (!ebayEnabled()) return { comps: [], errors: [] };
  const tasks = [activeListings(q)];
  if (config.ebayInsights) tasks.push(soldComps(q));
  const results = await Promise.allSettled(tasks);
  const comps: Comp[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") comps.push(...r.value.filter((c) => Number.isFinite(c.price_usd)));
    else errors.push(String(r.reason?.message ?? r.reason));
  }
  return { comps, errors };
}
