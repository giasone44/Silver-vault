const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function money(n: number | null | undefined, opts?: { whole?: boolean }): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return (opts?.whole ? usd0 : usd).format(n);
}

export function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export function oz(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Number(n.toFixed(4))} oz t`;
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return "never";
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const typeLabel: Record<string, string> = { coin: "Coin", round: "Round", bar: "Bar", other: "Other" };
