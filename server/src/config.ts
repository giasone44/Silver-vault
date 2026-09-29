import path from "node:path";

const env = process.env;

export const config = {
  port: Number(env.PORT ?? 8787),
  dataDir: path.resolve(env.DATA_DIR ?? "./data"),
  appToken: env.APP_TOKEN ?? "",
  // AI: Claude when an Anthropic key is configured, otherwise a free local model via Ollama.
  aiProvider: (env.AI_PROVIDER ?? (env.ANTHROPIC_API_KEY ? "claude" : "ollama")) as "claude" | "ollama",
  claudeModel: env.CLAUDE_MODEL ?? "claude-opus-5-5",
  ollamaUrl: (env.OLLAMA_URL ?? "http://127.0.0.1:11434").replace(/\/+$/, ""),
  ollamaModel: env.OLLAMA_MODEL ?? "qwen2.5vl:3b",
  // Free coin catalogue (numista.com/api): exact specs and price guides.
  numistaKey: env.NUMISTA_API_KEY ?? "",
  spotProvider: (env.SPOT_PROVIDER ?? "gold-api") as "gold-api" | "metals-dev" | "goldapi-io",
  spotApiKey: env.SPOT_API_KEY ?? "",
  spotTtlMs: Number(env.SPOT_TTL_SECONDS ?? 30) * 1000,
  ebayClientId: env.EBAY_CLIENT_ID ?? "",
  ebayClientSecret: env.EBAY_CLIENT_SECRET ?? "",
  ebayInsights: env.EBAY_MARKETPLACE_INSIGHTS === "true",
  webDistDir: path.resolve(env.WEB_DIST_DIR ?? "../app/dist"),
  /** Settings file the launcher reads; keys saved from the app are written here. */
  configFile: path.resolve(env.CONFIG_FILE ?? path.join(env.DATA_DIR ?? "./data", "config.env")),
};
