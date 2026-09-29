import type { CatalogIssue } from "./types";

// Mirrors findIssue in server/src/numista.ts.
export function findIssue(issues: CatalogIssue[], year: string | null | undefined, mintMark: string | null | undefined) {
  const y = year ? Number(String(year).match(/\d{4}/)?.[0]) : null;
  const mark = (mintMark ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  const sameYear = issues.filter((i) => !y || i.year === y);
  return sameYear.find((i) => (i.mint_letter ?? "").toUpperCase() === mark) ?? (y ? sameYear[0] : undefined) ?? null;
}
