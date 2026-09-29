import * as z from "zod/v4";
import { config } from "./config.js";
import { MAKERS } from "./makers.js";
import type { Identification } from "./schemas.js";

// Free, private photo identification with a vision model running on this Mac
// through Ollama (ollama.com). Kept deliberately lean for 8 GB Macs:
//  - the model only transcribes what it can read (no long descriptions);
//    exact specifications come from the Numista catalogue afterwards,
//  - photos arrive downscaled by the app,
//  - the model stays loaded between pieces instead of reloading each time.

export class LocalAiError extends Error {}

type Photo = { base64: string };

/** How long Ollama keeps the model in memory after a request. */
const KEEP_ALIVE = "30m";

/** Only what can be read from the photos; everything else comes from the catalogue. */
const LocalReading = z.object({
  name: z.string(),
  item_type: z.enum(["coin", "round", "bar", "other"]),
  category: z.enum(["bullion", "semi-numismatic", "numismatic"]),
  metal: z.enum(["silver", "gold", "platinum", "palladium", "copper", "other"]),
  purity: z.number().nullable(),
  weight_troy_oz: z.number().nullable(),
  year: z.string().nullable(),
  mint: z.string().nullable(),
  mint_mark: z.string().nullable(),
  country: z.string().nullable(),
  denomination: z.string().nullable(),
  serial_number: z.string().nullable(),
  certification_service: z.enum(["none", "PCGS", "NGC", "ANACS", "ICG", "CAC", "other"]),
  certification_grade: z.string().nullable(),
  cert_number: z.string().nullable(),
  estimated_grade: z.string().nullable(),
  condition: z.string().nullable(),
  search_query: z.string(),
  confidence: z.number(),
  unclear: z.string().nullable(),
});
type LocalReading = z.infer<typeof LocalReading>;

const schema = z.toJSONSchema(LocalReading);

const SYSTEM = `You catalogue coins, bullion rounds and bars from photos. Copy printed text exactly. Be brief.
- item_type: coin (government issue with a denomination), round (private round), bar (ingot).
- category: bullion (valued for metal), numismatic (collector coin), semi-numismatic (in between).
- purity as a decimal (0.999). weight_troy_oz from the stamp, e.g. "1 OZ" -> 1, "10 OZ" -> 10.
- mint: the mint or refiner. Known makers include: ${MAKERS.map((m) => m.name).join(", ")}.
- serial_number: stamped on many bars.
- Slabs: copy grading service, grade and cert number from the label.
- Use null for anything unreadable. Never guess a year or mint mark.
- search_query: short collector search, e.g. "1881-S Morgan Dollar" or "10 oz Engelhard silver bar".
- condition: a few words at most. unclear: what a closer photo would fix, or null.`;

async function ollama(path: string, init?: RequestInit) {
  try {
    return await fetch(`${config.ollamaUrl}${path}`, init);
  } catch {
    throw new LocalAiError("The local AI (Ollama) isn't running. Open the Ollama app on your Mac and try again.");
  }
}

export async function ollamaStatus(): Promise<{ running: boolean; modelReady: boolean }> {
  try {
    const res = await fetch(`${config.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
    const j = (await res.json()) as { models?: { name: string }[] };
    const want = config.ollamaModel.includes(":") ? config.ollamaModel : `${config.ollamaModel}:latest`;
    return { running: true, modelReady: Boolean(j.models?.some((m) => m.name === want)) };
  } catch {
    return { running: false, modelReady: false };
  }
}

/** Loads the model into memory ahead of time so the first identification doesn't wait for it. */
export async function warmUp(): Promise<void> {
  await fetch(`${config.ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.ollamaModel, keep_alive: KEEP_ALIVE }),
  })
    .then((r) => r.body?.cancel())
    .catch(() => {});
}

function toIdentification(r: LocalReading): Identification {
  return {
    name: r.name,
    item_type: r.item_type,
    category: r.category,
    metal: r.metal,
    purity: r.purity,
    gross_weight_troy_oz: r.weight_troy_oz,
    fine_weight_troy_oz: r.weight_troy_oz != null && r.purity != null ? Number((r.weight_troy_oz * r.purity).toFixed(4)) : null,
    weight_grams: null,
    diameter_mm: null,
    thickness_mm: null,
    country: r.country,
    mint: r.mint,
    mint_mark: r.mint_mark,
    year: r.year,
    denomination: r.denomination,
    series: null,
    catalog_number: null,
    mintage: null,
    designer: null,
    obverse_description: "",
    reverse_description: "",
    edge: null,
    certification_service: r.certification_service,
    certification_grade: r.certification_grade,
    cert_number: r.cert_number,
    estimated_grade: r.estimated_grade,
    condition_notes: [r.condition, r.serial_number && `Serial no. ${r.serial_number}`].filter(Boolean).join(". ") || null,
    variety_or_error: null,
    search_query: r.search_query,
    confidence: r.confidence,
    notes_for_user: r.unclear,
  };
}

/** Give up rather than spin forever if the Mac can't keep up. */
const IDENTIFY_TIMEOUT_MS = 180_000;

export async function ollamaIdentify(obverse: Photo, reverse: Photo | null): Promise<Identification> {
  try {
    return await readPhotos(obverse, reverse);
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new LocalAiError(
        "The free on-Mac AI took too long on this Mac. For fast, accurate results add a Claude key in Settings.",
      );
    }
    throw err;
  }
}

async function readPhotos(obverse: Photo, reverse: Photo | null): Promise<Identification> {
  const res = await ollama("/api/chat", {
    method: "POST",
    signal: AbortSignal.timeout(IDENTIFY_TIMEOUT_MS),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.ollamaModel,
      stream: true, // streamed so slow Macs don't hit HTTP header timeouts
      keep_alive: KEEP_ALIVE,
      format: schema,
      options: { temperature: 0, num_ctx: 4096, num_predict: 600 },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: reverse ? "Image 1: obverse. Image 2: reverse. Catalogue this item." : "Obverse. Catalogue this item.",
          images: reverse ? [obverse.base64, reverse.base64] : [obverse.base64],
        },
      ],
    }),
  });
  if (res.status === 404) {
    throw new LocalAiError(`The AI model "${config.ollamaModel}" isn't downloaded yet. Restart Silver Vault to download it.`);
  }
  if (!res.ok || !res.body) throw new LocalAiError(`Local AI error: HTTP ${res.status} ${await res.text().catch(() => "")}`);

  // Ollama streams one JSON object per line; collect the message text.
  let text = "";
  let buffer = "";
  const decoder = new TextDecoder();
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const part = JSON.parse(line) as { message?: { content?: string }; error?: string };
      if (part.error) throw new LocalAiError(`Local AI error: ${part.error}`);
      text += part.message?.content ?? "";
    }
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new LocalAiError("The local AI returned an unreadable answer. Try again, or use closer photos.");
  }
  const parsed = LocalReading.safeParse(raw);
  if (parsed.success) return toIdentification(parsed.data);
  throw new LocalAiError("The local AI's answer was incomplete. Try again, or enter the details by hand.");
}
