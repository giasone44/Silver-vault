import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaMessage, BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { config } from "./config.js";
import { Identification, MarketResearch, type Comp, type Item } from "./schemas.js";

const client = new Anthropic();

// Opt into server-side fallbacks so a safety-classifier false positive is
// retried on another model instead of failing the request.
const FALLBACK: { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: "default" } = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

export class AiError extends Error {}

function assertNotRefused(msg: BetaMessage) {
  if (msg.stop_reason === "refusal") throw new AiError("The model declined this request. Try different photos.");
}

type Photo = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };

const IDENTIFY_SYSTEM = `You are an expert numismatist and precious-metals dealer. You identify coins, rounds and bars from photographs with the precision of a professional grader and cataloger.

Rules:
- Read every legend, date, mint mark, hallmark, serial number, and slab label you can see. Prefer what is visibly printed over assumptions.
- Use your knowledge of standard specifications (e.g. an American Silver Eagle 2021+ is 31.103 g, 0.999 fine, 40.6 mm) to fill in weight, purity, diameter, and fine metal content.
- For graded slabs, transcribe the service, grade, and certification number exactly.
- For raw coins, give an honest estimated grade range and describe visible condition issues.
- Leave a field null rather than guessing when it cannot be determined, and say what photo would resolve it.
- search_query should be what a dealer would type into eBay's sold listings to find this exact item (include year, mint mark, grade/slab where relevant).`;

export async function identify(obverse: Photo, reverse: Photo | null): Promise<Identification> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    { type: "text", text: "Photo 1 - obverse (front):" },
    { type: "image", source: { type: "base64", media_type: obverse.mediaType, data: obverse.base64 } },
  ];
  if (reverse) {
    content.push(
      { type: "text", text: "Photo 2 - reverse (back):" },
      { type: "image", source: { type: "base64", media_type: reverse.mediaType, data: reverse.base64 } },
    );
  }
  content.push({ type: "text", text: "Identify this item and catalog its full specifications." });

  const msg = await client.beta.messages.parse({
    model: config.claudeModel,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "high", format: betaZodOutputFormat(Identification) },
    system: IDENTIFY_SYSTEM,
    messages: [{ role: "user", content }],
  });
  assertNotRefused(msg);
  if (!msg.parsed_output) throw new AiError("Could not read the identification result.");
  return msg.parsed_output;
}

const VALUE_SYSTEM = `You are a precious-metals and coin market analyst. Your job is to determine what an item is actually worth today based on what buyers have ACTUALLY PAID recently - not asking prices.

Research method:
1. Search for recent completed/sold sales of this exact item: eBay sold listings, Heritage / GreatCollections / Stack's Bowers auction archives, and dealer buy/sell prices (APMEX, JM Bullion, SD Bullion, etc.). For graded coins also check PCGS/NGC price guides and population context.
2. Match year, mint mark, grade, and certification as closely as possible. Discard lots, damaged items, and mismatched grades, or adjust for them.
3. Weight recent actual sales most heavily. Treat asking prices only as an upper bound.
4. Compare against melt value at the current spot price. Bullion items should land at a sensible premium over melt; if a price seems to be below melt, re-check.
5. Record every sale you relied on in comps, with its URL.

Be concise in your prose. When finished, output ONLY a single JSON object (no markdown fences) with exactly these keys:
pricing_model ("bullion"|"numismatic"), estimated_value_usd, low_usd, high_usd, dealer_buy_usd (number|null), dealer_sell_usd (number|null), confidence ("low"|"medium"|"high"), comps (array of {title, price_usd, date, source, url, kind: "sold"|"auction"|"dealer_sell"|"dealer_buy"|"price_guide"|"asking"}), summary, selling_tips.
All prices are USD for ONE unit.`;

function describeItem(item: Item) {
  const fields: Record<string, unknown> = {
    name: item.name,
    type: item.item_type,
    category: item.category,
    metal: item.metal,
    purity: item.purity,
    fine_weight_troy_oz: item.fine_weight_troy_oz,
    gross_weight_troy_oz: item.gross_weight_troy_oz,
    year: item.year,
    mint: item.mint,
    mint_mark: item.mint_mark,
    country: item.country,
    denomination: item.denomination,
    series: item.series,
    catalog_number: item.catalog_number,
    certification: item.certification_service && item.certification_service !== "none"
      ? `${item.certification_service} ${item.certification_grade ?? ""} #${item.cert_number ?? "?"}`
      : "raw (uncertified)",
    grade: item.grade ?? item.specs?.estimated_grade,
    condition: item.condition_notes,
    variety_or_error: item.specs?.variety_or_error,
    search_query: item.search_query ?? item.specs?.search_query,
  };
  return Object.entries(fields)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object");
  return JSON.parse(text.slice(start, end + 1));
}

export async function researchMarket(
  item: Item,
  ctx: { spot: number | null; melt: number | null; ebay: Comp[] },
): Promise<MarketResearch> {
  let prompt = `Determine the current fair market value of this item.\n\n${describeItem(item)}\n\n`;
  prompt += ctx.spot != null
    ? `Current ${item.metal} spot: $${ctx.spot.toFixed(2)}/troy oz. Melt value per unit: $${ctx.melt?.toFixed(2) ?? "unknown"}.\n`
    : `Spot price is unavailable right now.\n`;
  prompt += `Today's date: ${new Date().toISOString().slice(0, 10)}.\n`;
  if (ctx.ebay.length) {
    prompt += `\nData pulled from the eBay API (verify relevance before using):\n${JSON.stringify(ctx.ebay.slice(0, 40))}\n`;
  }

  const tools: Anthropic.Beta.BetaToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: 10 },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 6 },
  ];
  const messages: BetaMessageParam[] = [{ role: "user", content: prompt }];

  let msg: BetaMessage | undefined;
  // Server-side tool loops can pause; resume by sending the paused turn back.
  for (let i = 0; i < 5; i++) {
    // Streamed so long research turns don't hit HTTP timeouts.
    msg = await client.beta.messages
      .stream({
        model: config.claudeModel,
        max_tokens: 32000,
        ...FALLBACK,
        output_config: { effort: "high" },
        system: VALUE_SYSTEM,
        tools,
        messages,
      })
      .finalMessage();
    assertNotRefused(msg);
    if (msg.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: msg.content });
  }
  if (!msg) throw new AiError("No response from model.");

  const lastText = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const direct = MarketResearch.safeParse((() => { try { return extractJson(lastText); } catch { return null; } })());
  if (direct.success) return direct.data;

  // The research text did not end in clean JSON; ask for a structured restatement.
  const structured = await client.beta.messages.parse({
    model: config.claudeModel,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "low", format: betaZodOutputFormat(MarketResearch) },
    messages: [
      {
        role: "user",
        content: `Convert this market research into the required structure. Do not invent sales that are not mentioned.\n\n${lastText}`,
      },
    ],
  });
  assertNotRefused(structured);
  if (!structured.parsed_output) throw new AiError("Could not read the valuation result.");
  return structured.parsed_output;
}
