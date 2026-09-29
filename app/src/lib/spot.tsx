import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { useApi } from "./api";
import { useSettings } from "./settings";
import type { SpotQuote } from "./types";

export const SPOT_METALS = ["silver", "gold", "platinum", "palladium"] as const;
export type SpotMetal = (typeof SPOT_METALS)[number];

type Ctx = {
  quote: SpotQuote | null;
  /** % change vs. the oldest quote the server recorded in the last 24h (or since the app opened). */
  change: Record<SpotMetal, number | null>;
  /** Earliest time the change is measured from. */
  since: string | null;
  error: string | null;
  refresh: () => Promise<void>;
};
const SpotContext = createContext<Ctx | null>(null);

export function SpotProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const { settings } = useSettings();
  const [quote, setQuote] = useState<SpotQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [since, setSince] = useState<string | null>(null);
  const ref = useRef<Partial<Record<SpotMetal, number>>>({});

  const loadReference = useCallback(async () => {
    const results = await Promise.all(SPOT_METALS.map((m) => api.spotHistory(m, 24).catch(() => [])));
    let earliest: string | null = null;
    results.forEach((rows, i) => {
      if (rows[0]) {
        ref.current[SPOT_METALS[i]] = rows[0].price;
        if (!earliest || rows[0].minute < earliest) earliest = rows[0].minute;
      }
    });
    setSince(earliest);
  }, [api]);

  const refresh = useCallback(async () => {
    try {
      const q = await api.spot();
      for (const m of SPOT_METALS) if (ref.current[m] == null && q[m] != null) ref.current[m] = q[m]!;
      setQuote(q);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api]);

  useEffect(() => {
    void loadReference().then(refresh);
    const tick = setInterval(refresh, Math.max(10, settings.spotRefreshSeconds) * 1000);
    const refTick = setInterval(loadReference, 5 * 60_000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && void refresh());
    return () => {
      clearInterval(tick);
      clearInterval(refTick);
      sub.remove();
    };
  }, [loadReference, refresh, settings.spotRefreshSeconds]);

  const change = Object.fromEntries(
    SPOT_METALS.map((m) => {
      const now = quote?.[m];
      const base = ref.current[m];
      return [m, now != null && base ? ((now - base) / base) * 100 : null];
    }),
  ) as Record<SpotMetal, number | null>;

  return <SpotContext.Provider value={{ quote, change, since, error, refresh }}>{children}</SpotContext.Provider>;
}

export function useSpot() {
  const ctx = useContext(SpotContext);
  if (!ctx) throw new Error("useSpot outside SpotProvider");
  return ctx;
}
