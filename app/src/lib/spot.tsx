import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { useApi } from "./api";
import { useSettings } from "./settings";
import type { SpotQuote } from "./types";

type Ctx = {
  quote: SpotQuote | null;
  /** Silver price at the first quote this session, for the change indicator. */
  sessionOpen: Partial<Record<"silver" | "gold", number>>;
  error: string | null;
  refresh: () => Promise<void>;
};
const SpotContext = createContext<Ctx | null>(null);

export function SpotProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const { settings, loaded } = useSettings();
  const [quote, setQuote] = useState<SpotQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = useRef<Ctx["sessionOpen"]>({});

  const refresh = useCallback(async () => {
    try {
      const q = await api.spot();
      if (open.current.silver == null && q.silver != null) open.current.silver = q.silver;
      if (open.current.gold == null && q.gold != null) open.current.gold = q.gold;
      setQuote(q);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api]);

  useEffect(() => {
    if (!loaded) return;
    void refresh();
    const timer = setInterval(refresh, Math.max(10, settings.spotRefreshSeconds) * 1000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && void refresh());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [loaded, refresh, settings.spotRefreshSeconds]);

  return (
    <SpotContext.Provider value={{ quote, sessionOpen: open.current, error, refresh }}>{children}</SpotContext.Provider>
  );
}

export function useSpot() {
  const ctx = useContext(SpotContext);
  if (!ctx) throw new Error("useSpot outside SpotProvider");
  return ctx;
}
