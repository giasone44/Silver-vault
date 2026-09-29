import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaMessage, BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { config } from "./config.js";
import { MAKERS, type Maker } from "./makers.js";
import { Dossier, Identification, MarketResearch, type Comp, type Item } from "./schemas.js";
import type * as z from "zod/v4";

// Each request is retried a couple of times by the SDK, then resilient() below
// moves on to the next option rather than letting one busy model fail a scan.
const MAX_RETRIES = 2;
const BACKUP_MODEL = "claude-sonnet-5-5";
let client = new Anthropic({ maxRetries: MAX_RETRIES });

/** Switches to a new API key without restarting (set from the app's Settings screen). */
export function useApiKey(apiKey: string) {
  process.env.ANTHROPIC_API_KEY = apiKey;
  client = new Anthropic({ apiKey, maxRetries: MAX_RETRIES });
}

/** Confirms a key works before it is saved. */
export async function checkApiKey(apiKey: string): Promise<boolean> {
  try {
    await new Anthropic({ apiKey }).models.retrieve(config.claudeModel);
    return true;
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return false;
    throw err;
  }
}

// Opt into server-side fallbacks so a safety-classifier false positive is
// retried on another model instead of failing the request.
const FALLBACK: { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: "default" } = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

export class AiError extends Error {}

type Attempt = { model: string; extra: Partial<typeof FALLBACK> };

/**
 * Runs a Claude request, falling back when Anthropic is busy or a request
 * option is rejected: first the configured model with server-side fallbacks,
 * then the same model without that beta option, then a second model.
 */
async function resilient<T>(run: (a: Attempt) => Promise<T>): Promise<T> {
  const attempts: Attempt[] = [
    { model: config.claudeModel, extra: FALLBACK },
    { model: config.claudeModel, extra: {} },
    { model: BACKUP_MODEL, extra: {} },
  ];
  let last: unknown;
  for (const attempt of attempts) {
    try {
      return await run(attempt);
    } catch (err) {
      last = err;
      if (!(err instanceof Anthropic.APIError)) throw err;
      const status = err.status ?? 0; // 0 = connection problem
      const optionRejected = status === 400 && /fallback|beta/i.test(err.message);
      if (!(status === 0 || status === 429 || status >= 500 || optionRejected)) throw err;
      console.warn(`Claude ${attempt.model} unavailable (${status || "connection"}): trying the next option`);
    }
  }
  throw last;
}

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
- Bars and rounds: identify the refiner or private mint from its name, logo and hallmark style, and record the serial number (in condition_notes) and style (poured, extruded, struck) - these drive collector value. Well-known makers include: ${MAKERS.map((m) => m.name).join(", ")}.
- search_query should be what a dealer would type into eBay's sold listings to find this exact item (include year, mint mark, grade/slab, refiner and style where relevant).`;

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

  const msg = await resilient(({ model, extra }) =>
    client.beta.messages.parse({
      model,
      max_tokens: 16000,
      ...extra,
      output_config: { effort: "high", format: betaZodOutputFormat(Identification) },
      system: IDENTIFY_SYSTEM,
      messages: [{ role: "user", content }],
    }),
  );
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
  ctx: {
    spot: number | null;
    melt: number | null;
    ebay: Comp[];
    guide?: { price: number; low: number; high: number; comps: Comp[] } | null;
    maker?: Maker | null;
  },
): Promise<MarketResearch> {
  let prompt = `Determine the current fair market value of this item.\n\n${describeItem(item)}\n\n`;
  prompt += ctx.spot != null
    ? `Current ${item.metal} spot: $${ctx.spot.toFixed(2)}/troy oz. Melt value per unit: $${ctx.melt?.toFixed(2) ?? "unknown"}.\n`
    : `Spot price is unavailable right now.\n`;
  prompt += `Today's date: ${new Date().toISOString().slice(0, 10)}.\n`;
  if (item.specs?.mintage) prompt += `Recorded mintage for this issue: ${item.specs.mintage}.\n`;
  if (ctx.maker) prompt += `\nMaker background (${ctx.maker.name}): ${ctx.maker.about} ${ctx.maker.collecting}\n`;
  if (ctx.guide) {
    prompt += `\nNumista catalogue price guide for this year/mint (USD, by grade - a reference, not actual sales): ${ctx.guide.comps
      .map((c) => `${c.title.split(" · ")[1]} $${c.price_usd}`)
      .join(", ")}.\n`;
  }
  if (ctx.ebay.length) {
    prompt += `\nData pulled from the eBay API (verify relevance before using):\n${JSON.stringify(ctx.ebay.slice(0, 40))}\n`;
  }

  return webResearch(VALUE_SYSTEM, prompt, MarketResearch, "market research", { searches: 10, fetches: 6 });
}

/**
 * Runs Claude with web search and page reading, then returns the JSON object
 * its final answer ends with. If that isn't clean JSON, a second, cheap call
 * restates the research in the required structure.
 */
async function webResearch<T extends z.ZodType>(
  system: string,
  prompt: string,
  schema: T,
  what: string,
  limits: { searches: number; fetches: number },
): Promise<z.infer<T>> {
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: limits.searches },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: limits.fetches },
  ];
  const msg = await resilient(async ({ model, extra }) => {
    const messages: BetaMessageParam[] = [{ role: "user", content: prompt }];
    let m: BetaMessage | undefined;
    // Server-side tool loops can pause; resume by sending the paused turn back.
    for (let i = 0; i < 5; i++) {
      // Streamed so long research turns don't hit HTTP timeouts.
      m = await client.beta.messages
        .stream({ model, max_tokens: 32000, ...extra, output_config: { effort: "high" }, system, tools, messages })
        .finalMessage();
      assertNotRefused(m);
      if (m.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: m.content });
    }
    if (!m) throw new AiError("No response from model.");
    return m;
  });

  const lastText = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const direct = schema.safeParse((() => { try { return extractJson(lastText); } catch { return null; } })());
  if (direct.success) return direct.data;

  const structured = await resilient(({ model, extra }) =>
    client.beta.messages.parse({
      model,
      max_tokens: 16000,
      ...extra,
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      messages: [
        {
          role: "user",
          content: `Convert this ${what} into the required structure. Keep every fact and source; do not invent anything that is not stated.\n\n${lastText}`,
        },
      ],
    }),
  );
  assertNotRefused(structured);
  if (!structured.parsed_output) throw new AiError(`Could not read the ${what} result.`);
  return structured.parsed_output as z.infer<T>;
}

const DOSSIER_SYSTEM = `You are a senior numismatic researcher compiling a reference file on one coin, round or bar for its owner, who knows nothing about it yet. Be thorough and exact.

Research method:
1. Consult authoritative sources: the issuing mint or refiner, PCGS CoinFacts, NGC Coin Explorer, Numista, the Standard Catalog of World Coins (KM numbers), reputable dealers and collector references for private bars.
2. Confirm the exact specifications (composition, fineness, weight, diameter, thickness, edge) for this type and year.
3. Find the mintage for this exact year and mint mark, and how scarce it is within the series. Private bars and rounds have no published mintages: say so and explain what drives their rarity instead (era, variety, serial range).
4. List known varieties, errors or die differences the owner should check for, and practical ways to confirm the piece is genuine.
5. Every statement must be supported by what you found; if something is uncertain, say so. Record the sources you used.

Write in plain English for a collector. When finished, output ONLY a single JSON object (no markdown fences) with exactly these keys:
summary, history, obverse_design, reverse_design, designer (string|null), specifications ({composition, purity, weight_grams, gross_weight_troy_oz, fine_weight_troy_oz, diameter_mm, thickness_mm, edge} - numbers or null), mintage (string|null), mintage_context (string|null), key_facts (string[]), varieties (string[]), authentication (string[]), grading_notes (string|null), care (string|null), sources ([{title, url}]).`;

export async function researchDossier(item: Item, maker: Maker | null): Promise<Dossier> {
  let prompt = `Compile the reference file for this piece.\n\n${describeItem(item)}\n`;
  if (item.specs?.obverse_description) prompt += `\nObverse as photographed: ${item.specs.obverse_description}`;
  if (item.specs?.reverse_description) prompt += `\nReverse as photographed: ${item.specs.reverse_description}`;
  if (maker) prompt += `\n\nMaker background (${maker.name}): ${maker.about}`;
  return webResearch(DOSSIER_SYSTEM, prompt, Dossier, "reference file", { searches: 8, fetches: 6 });
}
