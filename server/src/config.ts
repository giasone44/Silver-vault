import path from "node:path";

const env = process.env;

export const config = {
  port: Number(env.PORT ?? 8787),
  dataDir: path.resolve(env.DATA_DIR ?? "./data"),
  appToken: env.APP_TOKEN ?? "",
  claudeModel: env.CLAUDE_MODEL ?? "claude-opus-5-5",
  spotProvider: (env.SPOT_PROVIDER ?? "gold-api") as "gold-api" | "metals-dev" | "goldapi-io",
  spotApiKey: env.SPOT_API_KEY ?? "",
  spotTtlMs: Number(env.SPOT_TTL_SECONDS ?? 30) * 1000,
  ebayClientId: env.EBAY_CLIENT_ID ?? "",
  ebayClientSecret: env.EBAY_CLIENT_SECRET ?? "",
  ebayInsights: env.EBAY_MARKETPLACE_INSIGHTS === "true",
  webDistDir: path.resolve(env.WEB_DIST_DIR ?? "../app/dist"),
};
