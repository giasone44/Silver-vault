import * as z from "zod/v4";
import { config } from "./config.js";
import { MAKERS } from "./makers.js";
import { Identification } from "./schemas.js";

// Free, private photo identification with a vision model running on this Mac
// through Ollama (ollama.com). Small models read legends and dates well but
// know less about exact specifications, so the catalogue lookup (numista.ts)
// fills those in afterwards.

export class LocalAiError extends Error {}

type Photo = { base64: string };

const SYSTEM = `You are an expert numismatist cataloguing coins, bullion rounds and bars from photographs.
Read every word, number, date, mint mark, hallmark, fineness stamp and slab label that is visible. Copy text exactly as printed.
Rules:
- item_type: "coin" if issued by a government with a denomination, "round" for private round bullion, "bar" for rectangular ingots.
- category: "bullion" if it trades mainly for metal content, "numismatic" for collector coins, "semi-numismatic" in between.
- purity as a decimal (0.999, 0.9999, 0.900). Weights in troy ounces. If a weight like "1 OZ" or "10 OZ" is stamped, use it.
- For graded slabs, copy the grading service, grade and certification number from the label.
- Use null for anything you cannot see or do not know. Never guess a mint mark or year you cannot read.
- mint: the issuing mint or refiner. Look for maker names and logos such as: ${MAKERS.map((m) => m.name).join(", ")}.
  On bars, the maker's name or logo and a serial number are usually stamped on the face.
- search_query: the words a collector would type to find this exact item, e.g. "1881-S Morgan Dollar" or "10 oz Engelhard silver bar".
- confidence: 0 to 1.
- notes_for_user: what is unclear and which closer photo would help, or null.`;

const schema = z.toJSONSchema(Identification);

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

export async function ollamaIdentify(obverse: Photo, reverse: Photo | null): Promise<Identification> {
  const res = await ollama("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.ollamaModel,
      stream: true, // streamed so slow Macs don't hit HTTP header timeouts
      format: schema,
      options: { temperature: 0, num_ctx: 8192 },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: reverse
            ? "Image 1 is the obverse (front), image 2 is the reverse (back). Catalogue this item as JSON."
            : "This image is the obverse (front). Catalogue this item as JSON.",
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
  const parsed = Identification.safeParse(raw);
  if (parsed.success) return parsed.data;
  throw new LocalAiError("The local AI's answer was incomplete. Try again, or enter the details by hand.");
}
