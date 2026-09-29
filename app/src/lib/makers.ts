import { useEffect, useState } from "react";
import { useApi } from "./api";
import type { Maker } from "./types";

// Mirrors matchMaker in server/src/makers.ts.
function normalise(s: string) {
  return ` ${s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9&.' -]/g, " ").replace(/\s+/g, " ")} `;
}

export function matchMaker(makers: Maker[], ...texts: (string | null | undefined)[]): Maker | null {
  const hay = normalise(texts.filter(Boolean).join(" | "));
  let best: { maker: Maker; len: number } | null = null;
  for (const maker of makers) {
    for (const alias of maker.aliases) {
      const a = alias.length <= 3 ? ` ${alias} ` : alias;
      if (hay.includes(a) && (!best || alias.length > best.len)) best = { maker, len: alias.length };
    }
  }
  return best?.maker ?? null;
}

let cache: Maker[] | null = null;

/** The register of mints and refiners (fetched once per session). */
export function useMakers(): Maker[] {
  const api = useApi();
  const [makers, setMakers] = useState<Maker[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    api.makers().then((m) => { cache = m; setMakers(m); }).catch(() => {});
  }, [api]);
  return makers;
}
