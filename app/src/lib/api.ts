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
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${s.serverUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(s.token ? { Authorization: `Bearer ${s.token}` } : {}),
          ...init.headers,
        },
      });
    } catch {
      throw new ApiError(`Can't reach the server at ${s.serverUrl}. Check Settings.`, 0);
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(body.error ?? `HTTP ${res.status}`, res.status);
    return body as T;
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
    identify: (obverse: Photo, reverse: Photo | null) =>
      call<Identification>("/api/identify", {
        method: "POST",
        body: JSON.stringify({ obverse: upload(obverse), reverse: upload(reverse) }),
      }),
    items: () => call<Item[]>("/api/items"),
    item: (id: string) => call<ItemDetail>(`/api/items/${id}`),
    create: (item: ItemInput, obverse?: Photo | null, reverse?: Photo | null) =>
      call<Item>("/api/items", {
        method: "POST",
        body: JSON.stringify({ item, obverse: upload(obverse), reverse: upload(reverse) }),
      }),
    update: (id: string, item: ItemInput, obverse?: Photo | null, reverse?: Photo | null) =>
      call<Item>(`/api/items/${id}`, {
        method: "PUT",
        body: JSON.stringify({ item, obverse: upload(obverse), reverse: upload(reverse) }),
      }),
    remove: (id: string) => call<{ ok: true }>(`/api/items/${id}`, { method: "DELETE" }),
    valuate: (id: string) => call<Item>(`/api/items/${id}/valuate`, { method: "POST" }),
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
