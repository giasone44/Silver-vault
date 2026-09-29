import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import * as z from "zod/v4";
import Anthropic from "@anthropic-ai/sdk";
import qrcode from "qrcode-terminal";
import { config } from "./config.js";
import { AiError, identify } from "./ai.js";
import * as db from "./db.js";
import { ebayEnabled } from "./ebay.js";
import { catalogSpecs, numistaEnabled, searchCatalog } from "./numista.js";
import { LocalAiError, ollamaIdentify, ollamaStatus } from "./ollama.js";
import { ItemInput, type Item } from "./schemas.js";
import { getSpot, spotFor, type SpotQuote } from "./spot.js";
import { fineOz, queueRevalue, revalueStatus, valuateItem } from "./valuate.js";

const photosDir = path.join(config.dataDir, "photos");

const Photo = z.object({
  base64: z.string().min(100),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
});
const SaveBody = z.object({ item: ItemInput, obverse: Photo.nullish(), reverse: Photo.nullish() });

function savePhoto(itemId: string, side: "obverse" | "reverse", photo: z.infer<typeof Photo>): string {
  const ext = photo.mediaType.split("/")[1] === "jpeg" ? "jpg" : photo.mediaType.split("/")[1];
  const file = `${itemId}-${side}-${randomUUID().slice(0, 8)}.${ext}`;
  fs.writeFileSync(path.join(photosDir, file), Buffer.from(photo.base64, "base64"));
  return file;
}

function removePhoto(file: string | null) {
  if (file) fs.rmSync(path.join(photosDir, path.basename(file)), { force: true });
}

function tokenOk(given: string | undefined | null): boolean {
  if (!config.appToken) return true;
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(config.appToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Current value of one unit: bullion valuations float with spot, numismatic ones stay fixed. */
function liveUnitValue(item: Item, quote: SpotQuote | null): { melt: number | null; unit: number | null } {
  const spot = quote ? spotFor(quote, item.metal) : null;
  const oz = fineOz(item);
  const melt = spot != null && oz != null ? spot * oz : null;
  const v = item.valuation;
  if (!v) return { melt, unit: melt };
  if (v.pricing_model === "bullion" && spot != null && v.spot_at_valuation != null && oz != null) {
    return { melt, unit: v.estimated_value_usd + (spot - v.spot_at_valuation) * oz };
  }
  return { melt, unit: v.estimated_value_usd };
}

const app = new Hono();

app.onError((err, c) => {
  console.error(err);
  if (err instanceof z.ZodError) return c.json({ error: "Invalid request", details: err.issues }, 400);
  if (err instanceof AiError) return c.json({ error: err.message }, 422);
  if (err instanceof LocalAiError) return c.json({ error: err.message }, 503);
  if (err instanceof Anthropic.AuthenticationError) return c.json({ error: "Server's Anthropic API key is invalid" }, 502);
  if (err instanceof Anthropic.RateLimitError) return c.json({ error: "AI rate limit reached - try again shortly" }, 429);
  if (err instanceof Anthropic.APIError) return c.json({ error: `AI service error: ${err.message}` }, 502);
  if (err instanceof Anthropic.AnthropicError) return c.json({ error: `AI is not configured on the server: ${err.message}` }, 503);
  return c.json({ error: err.message || "Server error" }, 500);
});

app.use("/api/*", cors());
app.use("/api/*", bodyLimit({ maxSize: 40 * 1024 * 1024 }));

app.get("/api/health", async (c) => {
  const local = config.aiProvider === "ollama" ? await ollamaStatus() : null;
  return c.json({
    ok: true,
    ai_provider: config.aiProvider,
    ai_model: config.aiProvider === "claude" ? config.claudeModel : config.ollamaModel,
    ai: local ? local.running && local.modelReady : Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    ai_detail: local ? (!local.running ? "Ollama not running" : !local.modelReady ? "Model not downloaded" : "Ready") : null,
    catalog: numistaEnabled(),
    ebay: ebayEnabled(),
    ebay_sold_data: ebayEnabled() && config.ebayInsights,
    spot_provider: config.spotProvider,
    auth_required: Boolean(config.appToken),
  });
});

// Everything below requires the app token (header or ?t= for <img> tags).
app.use("/api/*", async (c, next) => {
  const header = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!tokenOk(header ?? c.req.query("t"))) return c.json({ error: "Unauthorized" }, 401);
  await next();
});
app.use("/photos/*", async (c, next) => {
  if (!tokenOk(c.req.query("t"))) return c.text("Unauthorized", 401);
  await next();
});
app.use("/photos/*", serveStatic({ root: path.relative(process.cwd(), config.dataDir) }));

app.get("/api/spot", async (c) => c.json(await getSpot()));

app.get("/api/spot/history", (c) => {
  const metal = c.req.query("metal") ?? "silver";
  const hours = Number(c.req.query("hours") ?? 24);
  return c.json(db.spotHistory(metal, new Date(Date.now() - hours * 3600_000).toISOString()));
});

app.post("/api/identify", async (c) => {
  const body = z.object({ obverse: Photo, reverse: Photo.nullish() }).parse(await c.req.json());
  const reverse = body.reverse ?? null;
  return c.json(config.aiProvider === "claude" ? await identify(body.obverse, reverse) : await ollamaIdentify(body.obverse, reverse));
});

app.get("/api/catalog/search", async (c) => {
  if (!numistaEnabled()) return c.json({ error: "Catalogue not connected - add a free Numista API key." }, 400);
  const q = c.req.query("q")?.trim();
  if (!q) return c.json([]);
  const kind = c.req.query("type");
  const category = kind === "coin" ? "coin" : kind === "round" || kind === "bar" ? "exonumia" : undefined;
  return c.json(await searchCatalog(q, category));
});

app.get("/api/catalog/:id", async (c) => {
  if (!numistaEnabled()) return c.json({ error: "Catalogue not connected - add a free Numista API key." }, 400);
  return c.json(await catalogSpecs(Number(c.req.param("id"))));
});

app.get("/api/items", (c) => c.json(db.listItems()));

app.post("/api/items", async (c) => {
  const body = SaveBody.parse(await c.req.json());
  const item = db.createItem(body.item);
  db.setPhotos(
    item.id,
    body.obverse ? savePhoto(item.id, "obverse", body.obverse) : null,
    body.reverse ? savePhoto(item.id, "reverse", body.reverse) : null,
  );
  return c.json(db.getItem(item.id), 201);
});

app.get("/api/items/:id", (c) => {
  const item = db.getItem(c.req.param("id"));
  if (!item) return c.json({ error: "Not found" }, 404);
  return c.json({ ...item, history: db.valuationHistory(item.id) });
});

app.put("/api/items/:id", async (c) => {
  const existing = db.getItem(c.req.param("id"));
  if (!existing) return c.json({ error: "Not found" }, 404);
  const body = SaveBody.parse(await c.req.json());
  db.updateItem(existing.id, body.item);
  if (body.obverse) removePhoto(existing.obverse_photo);
  if (body.reverse) removePhoto(existing.reverse_photo);
  db.setPhotos(
    existing.id,
    body.obverse ? savePhoto(existing.id, "obverse", body.obverse) : null,
    body.reverse ? savePhoto(existing.id, "reverse", body.reverse) : null,
  );
  return c.json(db.getItem(existing.id));
});

app.delete("/api/items/:id", (c) => {
  const item = db.deleteItem(c.req.param("id"));
  if (!item) return c.json({ error: "Not found" }, 404);
  removePhoto(item.obverse_photo);
  removePhoto(item.reverse_photo);
  return c.json({ ok: true });
});

app.post("/api/items/:id/valuate", async (c) => c.json(await valuateItem(c.req.param("id"))));

app.post("/api/revalue", async (c) => {
  const body = z
    .object({ ids: z.array(z.string()).optional(), staleHours: z.number().optional() })
    .parse(await c.req.json().catch(() => ({})));
  return c.json({ queued: queueRevalue(body), status: revalueStatus });
});
app.get("/api/revalue", (c) => c.json(revalueStatus));

app.get("/api/export.csv", async (c) => {
  const quote = await getSpot().catch(() => null);
  const cols = [
    "name", "item_type", "category", "metal", "purity", "fine_weight_troy_oz", "year", "mint", "mint_mark",
    "country", "denomination", "series", "catalog_number", "certification_service", "certification_grade",
    "cert_number", "grade", "quantity", "purchase_price_per_unit", "purchase_date", "purchase_source",
    "storage_location", "melt_per_unit", "value_per_unit", "total_value", "value_low", "value_high",
    "valued_at", "notes",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(",")];
  for (const item of db.listItems()) {
    const { melt, unit } = liveUnitValue(item, quote);
    const row: Record<string, unknown> = {
      ...item,
      melt_per_unit: melt?.toFixed(2),
      value_per_unit: unit?.toFixed(2),
      total_value: unit != null ? (unit * item.quantity).toFixed(2) : null,
      value_low: item.valuation?.low_usd,
      value_high: item.valuation?.high_usd,
      valued_at: item.valuation?.valued_at,
    };
    lines.push(cols.map((k) => esc(row[k])).join(","));
  }
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="silver-vault-${new Date().toISOString().slice(0, 10)}.csv"`);
  return c.body(lines.join("\n"));
});

// Serve the desktop web build of the app (npm run build:web in /app) if present.
if (fs.existsSync(config.webDistDir)) {
  const root = path.relative(process.cwd(), config.webDistDir);
  app.use("/*", serveStatic({ root }));
  app.get("*", serveStatic({ root, path: "index.html" }));
}

if (!config.appToken) console.warn("WARNING: APP_TOKEN is not set - the API is open to anyone who can reach it.");
/** IPv4 addresses other devices can reach: home Wi-Fi/LAN, and Tailscale (100.x) if installed. */
function reachableAddresses() {
  const lan: string[] = [];
  const tailscale: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== "IPv4" || a.internal) continue;
      (a.address.startsWith("100.") ? tailscale : lan).push(a.address);
    }
  }
  return { lan, tailscale };
}

serve({ fetch: app.fetch, port: config.port, hostname: "0.0.0.0" }, (info) => {
  const { lan, tailscale } = reachableAddresses();
  const link = (host: string) => `http://${host}:${info.port}/${config.appToken ? `?t=${encodeURIComponent(config.appToken)}` : ""}`;
  console.log(`\n  Silver Vault is running.\n\n  On this Mac:  http://localhost:${info.port}`);
  if (lan[0]) {
    console.log(`\n  On your iPhone (same Wi-Fi): point the Camera app at this code and tap the link.\n`);
    qrcode.generate(link(lan[0]), { small: true }, (qr) => console.log(qr.replace(/^/gm, "  ")));
    console.log(`  ${link(lan[0])}`);
  }
  if (tailscale[0]) console.log(`\n  Away from home (Tailscale):  ${link(tailscale[0])}`);
  console.log(`\n  Keep this window open while you use Silver Vault. Press Control-C to stop.\n`);
});
