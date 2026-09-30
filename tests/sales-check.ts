// Run: node --import tsx tests/sales-check.ts (from /server). The value must follow actual sold prices.
import { checkAgainstSales } from "../server/src/valuate.ts";
const sold = (price_usd: number) => ({ title: "Swiss of America rolo", price_usd, date: "2026-09-20", source: "eBay", url: null, kind: "sold" as const });
const base = { pricing_model: "bullion" as const, estimated_value_usd: 60.37, low_usd: 58, high_usd: 64, dealer_buy_usd: null, dealer_sell_usd: null, confidence: "medium" as const, summary: "", selling_tips: null, comps: [sold(109.99), sold(76.06)] };
const fail = (m: string) => { console.log("FAIL", m); process.exitCode = 1; };
const a = checkAgainstSales(base, 60.37);
a.estimated_value_usd === 93.03 && a.pricing_model === "numismatic" && a.high_usd === 109.99 ? console.log("PASS melt answer replaced by sold median") : fail(JSON.stringify(a));
checkAgainstSales({ ...base, estimated_value_usd: 90 }, 60.37).estimated_value_usd === 90 ? console.log("PASS value agreeing with sales kept") : fail("changed a good value");
checkAgainstSales({ ...base, comps: [sold(109.99)] }, 60.37).estimated_value_usd === 60.37 ? console.log("PASS one sale is not enough to override") : fail("one sale overrode");
