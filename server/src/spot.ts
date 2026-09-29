import { config } from "./config.js";
import { recordSpot } from "./db.js";

export type SpotQuote = {
  silver: number | null;
  gold: number | null;
  platinum: number | null;
  palladium: number | null;
  /** USD per troy ounce. */
  currency: "USD";
  provider: string;
  fetched_at: string;
};

const METALS = ["silver", "gold", "platinum", "palladium"] as const;
const SYMBOLS: Record<(typeof METALS)[number], string> = {
  silver: "XAG",
  gold: "XAU",
  platinum: "XPT",
  palladium: "XPD",
};

let cached: SpotQuote | null = null;
let inflight: Promise<SpotQuote> | null = null;

async function getJson(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json() as Promise<any>;
}

async function fetchGoldApiCom(): Promise<Partial<SpotQuote>> {
  // Free, no key: https://gold-api.com
  const entries = await Promise.all(
    METALS.map(async (m) => {
      try {
        const j = await getJson(`https://api.gold-api.com/price/${SYMBOLS[m]}`);
        return [m, Number(j.price)] as const;
      } catch {
        return [m, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

async function fetchMetalsDev(): Promise<Partial<SpotQuote>> {
  // https://metals.dev - requires SPOT_API_KEY
  const j = await getJson(
    `https://api.metals.dev/v1/latest?api_key=${encodeURIComponent(config.spotApiKey)}&currency=USD&unit=toz`,
  );
  return {
    silver: j.metals?.silver ?? null,
    gold: j.metals?.gold ?? null,
    platinum: j.metals?.platinum ?? null,
    palladium: j.metals?.palladium ?? null,
  };
}

async function fetchGoldApiIo(): Promise<Partial<SpotQuote>> {
  // https://www.goldapi.io - requires SPOT_API_KEY
  const entries = await Promise.all(
    METALS.map(async (m) => {
      try {
        const j = await getJson(`https://www.goldapi.io/api/${SYMBOLS[m]}/USD`, {
          "x-access-token": config.spotApiKey,
        });
        return [m, Number(j.price)] as const;
      } catch {
        return [m, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

async function fetchFresh(): Promise<SpotQuote> {
  const fetcher =
    config.spotProvider === "metals-dev"
      ? fetchMetalsDev
      : config.spotProvider === "goldapi-io"
        ? fetchGoldApiIo
        : fetchGoldApiCom;
  const p = await fetcher();
  if (p.silver == null && p.gold == null) throw new Error(`Spot provider ${config.spotProvider} returned no prices`);
  const now = new Date();
  const quote: SpotQuote = {
    silver: p.silver ?? null,
    gold: p.gold ?? null,
    platinum: p.platinum ?? null,
    palladium: p.palladium ?? null,
    currency: "USD",
    provider: config.spotProvider,
    fetched_at: now.toISOString(),
  };
  recordSpot({ silver: quote.silver, gold: quote.gold, platinum: quote.platinum, palladium: quote.palladium }, now);
  return quote;
}

/** Returns a cached quote if it is fresher than SPOT_TTL_SECONDS, otherwise fetches. */
export async function getSpot(): Promise<SpotQuote> {
  if (cached && Date.now() - Date.parse(cached.fetched_at) < config.spotTtlMs) return cached;
  inflight ??= fetchFresh()
    .then((q) => (cached = q))
    .catch((err) => {
      // Serve a stale quote rather than nothing if the provider hiccups.
      if (cached) return cached;
      throw err;
    })
    .finally(() => (inflight = null));
  return inflight;
}

export function spotFor(quote: SpotQuote, metal: string): number | null {
  return (METALS as readonly string[]).includes(metal) ? quote[metal as (typeof METALS)[number]] : null;
}
