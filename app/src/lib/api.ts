import { useMemo } from "react";
import { useSettings, type Settings } from "./settings";
import type { CatalogHit, CatalogIssue, CatalogSpecs, Health, Maker, Identification, Item, ItemDetail, ItemInput, Photo, SpotQuote } from "./types";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type UploadPhoto = Pick<Photo, "base64" | "mediaType">;
const upload = (p?: Photo | null): UploadPhoto | null => (p ? { base64: p.base64, mediaType: p.mediaType } : null);

export function createApi(s: Settings) {
  /** Every request has a time limit so the app never spins indefinitely. */
  async function call<T>(path: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<T> {
    let res: Response;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      res = await fetch(`${s.serverUrl}${path}`, {
        ...init,
        signal: abort.signal,
        headers: {
          "Content-Type": "application/json",
          ...(s.token ? { Authorization: `Bearer ${s.token}` } : {}),
          ...init.headers,
        },
      });
    } catch (e) {
      if (abort.signal.aborted) {
        throw new ApiError("This took too long. Check that Silver Vault is still running on your Mac, then try again.", 0);
      }
      throw new ApiError("Can't reach Silver Vault. Make sure it's running on your Mac and your phone is on the same Wi-Fi.", 0);
    } finally {
      clearTimeout(timer);
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(body.error ?? `HTTP ${res.status}`, res.status);
    return body as T;
  }

  /**
   * Starts a long task on the Mac (identifying with web research can take a
   * couple of minutes), then checks back every few seconds until it finishes.
   * A dropped check, e.g. while the phone's screen was off, is simply retried.
   */
  async function runJob<T>(path: string, init: RequestInit, maxMs = 8 * 60_000): Promise<T> {
    const { job } = await call<{ job: string }>(path, init, 60_000);
    const until = Date.now() + maxMs;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, 2500));
      let state: { status: "running" | "done" | "failed"; result: T; error: string | null };
      try {
        state = await call(`/api/jobs/${job}`, {}, 15_000);
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) continue; // network blip: check again
        throw e;
      }
      if (state.status === "done") return state.result;
      if (state.status === "failed") throw new ApiError(state.error ?? "Something went wrong.", 500);
    }
    throw new ApiError("This is taking unusually long. Please try again.", 0);
  }

  return {
    health: () => call<Health>("/api/health"),
    catalogSearch: (q: string, type?: string) =>
      call<CatalogHit[]>(`/api/catalog/search?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ""}`),
    catalogSpecs: (id: number, at?: { year?: string | null; mintMark?: string | null }) =>
      call<CatalogSpecs>(`/api/catalog/${id}?year=${encodeURIComponent(at?.year ?? "")}&mint_mark=${encodeURIComponent(at?.mintMark ?? "")}`),
    catalogIssues: (id: number) => call<CatalogIssue[]>(`/api/catalog/${id}/issues`),
    makers: () => call<Maker[]>("/api/makers"),
    spot: () => call<SpotQuote>("/api/spot"),
    spotHistory: (metal: string, hours: number) =>
      call<{ minute: string; price: number }[]>(`/api/spot/history?metal=${metal}&hours=${hours}`),
    /** `small` sends the reduced copies, which the local AI reads far faster. */
    identify: (obverse: Photo, reverse: Photo | null, small = false, extras: Photo[] = []) => {
      const pick = (p: Photo | null) =>
        p ? { base64: small && p.aiBase64 ? p.aiBase64 : p.base64, mediaType: p.mediaType } : null;
      return runJob<Identification>("/api/identify", {
        method: "POST",
        body: JSON.stringify({ obverse: pick(obverse), reverse: pick(reverse), extras: extras.map(upload) }),
      });
    },
    warmup: () => call<{ ok: true }>("/api/warmup", { method: "POST" }),
    items: () => call<Item[]>("/api/items"),
    item: (id: string) => call<ItemDetail>(`/api/items/${id}`),
    create: (item: ItemInput, obverse?: Photo | null, reverse?: Photo | null, extras: Photo[] = []) =>
      call<Item>("/api/items", {
        method: "POST",
        body: JSON.stringify({ item, obverse: upload(obverse), reverse: upload(reverse), extras: extras.map(upload) }),
      }, 60_000),
    update: (id: string, item: ItemInput, obverse?: Photo | null, reverse?: Photo | null) =>
      call<Item>(`/api/items/${id}`, {
        method: "PUT",
        body: JSON.stringify({ item, obverse: upload(obverse), reverse: upload(reverse) }),
      }, 60_000),
    remove: (id: string) => call<{ ok: true }>(`/api/items/${id}`, { method: "DELETE" }),
    // Market research reads many sources; allow it several minutes.
    valuate: (id: string) => call<Item>(`/api/items/${id}/valuate`, { method: "POST" }, 360_000),
    /** Queues the full background research (reference file + market value). */
    research: (id: string) => call<Item>(`/api/items/${id}/research`, { method: "POST" }),
    /** Reads the saved photos again from scratch, then re-researches. */
    reidentify: (id: string) => runJob<Item>(`/api/items/${id}/reidentify`, { method: "POST" }),
    pairing: () => call<{ url: string; svg: string }>("/api/pairing"),
    version: () =>
      call<{ current: string | null; latest: string | null; update_available: boolean; auto_updates: boolean; repo_private: boolean }>(
        "/api/version",
      ),
    updateApp: () => call<{ started: boolean }>("/api/update", { method: "POST" }),
    saveAiKey: (key: string) =>
      call<{ ok: true; ai_provider: string; ai_model: string }>("/api/settings/ai-key", { method: "POST", body: JSON.stringify({ key }) }),
    revalue: (staleHours: number) =>
      call<{ queued: number }>("/api/revalue", { method: "POST", body: JSON.stringify({ staleHours }) }),
    photoUrl: (file: string | null) =>
      file ? `${s.serverUrl}/photos/${file}${s.token ? `?t=${encodeURIComponent(s.token)}` : ""}` : null,
    exportUrl: () => `${s.serverUrl}/api/export.csv${s.token ? `?t=${encodeURIComponent(s.token)}` : ""}`,
  };
}

export type Api = ReturnType<typeof createApi>;

export function useApi(): Api {
  const { settings } = useSettings();
  return useMemo(() => createApi(settings), [settings]);
}
