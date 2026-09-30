import http from "node:http";
const real = globalThis.fetch;
const prices = { XAG: 46.82, XAU: 3862.4, XPT: 1571.2, XPD: 1288.5 };
const J = (o) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });
globalThis.fetch = async (url, init) => {
  const u = String(url);
  const m = u.match(/api\.gold-api\.com\/price\/(\w+)/);
  if (m) return J({ price: prices[m[1]] });
  if (u.includes("/v1/messages")) {
    const body = JSON.parse(init.body);
    globalThis.__calls = (globalThis.__calls ?? []); globalThis.__calls.push(body.model);
    console.error("CLAUDE CALL", body.model, body.stream ? "stream" : "json", body.tools ? "tools" : "", body.output_config?.format ? "structured" : "");
    // Mirror Claude's structured-output limit: at most 16 nullable / union-typed parameters.
    const fmt = body.output_config?.format?.schema;
    if (fmt) {
      let unions = 0;
      const walk = (o) => { if (!o || typeof o !== "object") return; if (Array.isArray(o.anyOf) || Array.isArray(o.type)) unions++; Object.values(o).forEach(walk); };
      walk(fmt);
      if (unions > 16) return new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: `Schemas contains too many parameters with union types (${unions} parameters with type arrays or anyOf).` } }), { status: 400, headers: { "content-type": "application/json" } });
    }
    if (process.env.ALL_FAIL || (process.env.OPUS_FAIL && body.model === "claude-opus-5-5")) return new Response("upstream connect error.....", { status: 503, headers: { "content-type": "text/plain" } });
    const sys = typeof body.system === "string" ? body.system : "";
    // Identification now searches the web; IDENT_WEB_FAIL=1 breaks that step to test the photos-only fallback.
    if (process.env.IDENT_WEB_FAIL && body.tools && sys.includes("identify coins")) return new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "web search unavailable" } }), { status: 400, headers: { "content-type": "application/json" } });
    let text;
    if (sys.includes("identify coins")) {
      text = JSON.stringify({ name: "1964 Kennedy Half Dollar", item_type: "coin", category: "semi-numismatic", metal: "silver", purity: 0.9, gross_weight_troy_oz: 0.4019, fine_weight_troy_oz: 0.3617, weight_grams: 12.5, diameter_mm: 30.6, thickness_mm: 2.15, country: "United States", mint: "Philadelphia", mint_mark: null, year: "1964", denomination: "Half Dollar", series: "Kennedy Half Dollar", catalog_number: "KM# 202", mintage: "273,304,004", designer: "Gilroy Roberts / Frank Gasparro", obverse_description: "John F. Kennedy facing left, LIBERTY above, IN GOD WE TRUST, date below", reverse_description: "Presidential seal eagle, UNITED STATES OF AMERICA, HALF DOLLAR", edge: "Reeded", certification_service: "none", certification_grade: null, cert_number: null, estimated_grade: "AU-55 to MS-62", condition_notes: "Light contact marks", variety_or_error: null, search_query: "1964 Kennedy half dollar 90% silver", confidence: 0.96, notes_for_user: null, ...(JSON.stringify(body.messages).includes("Supporting photo 1") ? { purchase_price_per_unit: "$31.50", purchase_source: "Main Street Coins", purchase_date: "2026-09-12" } : {}) });
    } else if (sys.includes("reference file")) {
      text = "I researched it. " + JSON.stringify({ summary: "The 1964 Kennedy half dollar is the first year of the series and the only year struck in 90% silver for circulation.", history: "Authorized weeks after President Kennedy's assassination.", obverse_design: "Kennedy left", reverse_design: "Presidential seal", designer: "Gilroy Roberts", specifications: { composition: "90% silver, 10% copper", purity: 0.9, weight_grams: 12.5, gross_weight_troy_oz: 0.4019, fine_weight_troy_oz: 0.3617, diameter_mm: 30.6, thickness_mm: 2.15, edge: "Reeded" }, mintage: "273,304,004 (Philadelphia)", mintage_context: "Very common", key_facts: ["Only 90% silver Kennedy"], varieties: ["Accented Hair proof"], authentication: ["12.5 g, 30.6 mm"], grading_notes: "Check hair above ear", care: "Handle by edges", sources: [{ title: "PCGS CoinFacts", url: "https://www.pcgs.com" }] });
    } else if (sys.includes("market analyst")) {
      text = JSON.stringify({ pricing_model: "bullion", estimated_value_usd: 21.5, low_usd: 19, high_usd: 25, dealer_buy_usd: 17, dealer_sell_usd: 24, confidence: "high", comps: [{ title: "1964 Kennedy Half", price_usd: 21, date: "2026-09-20", source: "eBay", url: "https://ebay.com", kind: "sold" }], summary: "Trades near melt plus small premium.", selling_tips: "Sell locally." });
    } else {
      text = "{}";
    }
    const msg = { id: "msg_1", type: "message", role: "assistant", model: body.model, content: [{ type: "text", text }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } };
    if (!body.stream) return J(msg);
    const ev = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
    const sse = ev("message_start", { type: "message_start", message: { ...msg, content: [], stop_reason: null } })
      + ev("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })
      + ev("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } })
      + ev("content_block_stop", { type: "content_block_stop", index: 0 })
      + ev("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 10 } })
      + ev("message_stop", { type: "message_stop" });
    return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
  }
  if (u.includes("/v1/models/")) {
    const h = new Headers(init?.headers ?? (url instanceof Request ? url.headers : undefined));
    const key = h.get("x-api-key") ?? "";
    return key.includes("GOOD") ? J({ id: "claude-opus-5-5", type: "model" }) : new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }), { status: 401, headers: { "content-type": "application/json" } });
  }
  if (u.includes("api.numista.com")) {
    if (!init?.headers?.["Numista-API-Key"]) return new Response("", { status: 401 });
    if (u.includes("/types?")) return J({ count: 2, types: [
      { id: 3240, title: "1 Dollar \"Morgan Dollar\"", category: "coin", issuer: { name: "United States" }, min_year: 1878, max_year: 1921, obverse_thumbnail: null },
      { id: 999, title: "1 Dollar \"Peace Dollar\"", category: "coin", issuer: { name: "United States" }, min_year: 1921, max_year: 1935, obverse_thumbnail: null } ] });
    if (/\/types\/3240\/issues\/\d+\/prices/.test(u)) return J({ currency: "USD", prices: [ { grade: "vf", price: 48 }, { grade: "xf", price: 52 }, { grade: "au", price: 60 }, { grade: "unc", price: 95 } ] });
    if (u.includes("/types/3240/issues")) return J([ { id: 11, year: 1881, gregorian_year: 1881, mint_letter: "", mintage: 9163000 }, { id: 12, year: 1881, gregorian_year: 1881, mint_letter: "S", mintage: 12760000 } ]);
    if (u.includes("/types/3240")) return J({ id: 3240, url: "https://en.numista.com/catalogue/pieces3240.html", title: "1 Dollar \"Morgan Dollar\"", category: "coin", issuer: { name: "United States" }, value: { text: "1 Dollar" }, composition: { text: "Silver (.900)" }, weight: 26.73, size: 38.1, thickness: 2.4, obverse: { description: "Liberty head", engravers: ["George T. Morgan"] }, reverse: { description: "Eagle" }, edge: { description: "Reeded" }, references: [{ catalogue: { code: "KM" }, number: "110" }], mints: [{ name: "San Francisco" }] });
  }
  return real(url, init);
};
// fake Ollama
http.createServer((req, res) => {
  if (req.url === "/api/tags") return res.end(JSON.stringify({ models: [{ name: "qwen2.5vl:3b" }] }));
  let body = ""; req.on("data", (d) => (body += d)); req.on("end", () => {
    const b = JSON.parse(body);
    if (req.url !== "/api/generate" && (!b.format || !b.messages[1].images?.length)) { res.statusCode = 400; return res.end("bad"); }
    if (req.url === "/api/generate") { globalThis.__warm = (globalThis.__warm ?? 0) + 1; console.error("WARMUP", b.keep_alive); return res.end("{}"); }
    console.error("CHAT keep_alive=" + b.keep_alive + " num_ctx=" + b.options.num_ctx + " imgBytes=" + b.messages[1].images.map((i) => i.length).join(","));
    const ident = { name: "1881-S Morgan Dollar", item_type: "coin", category: "numismatic", metal: "silver", purity: 0.9, weight_troy_oz: null, year: "1881", mint: "San Francisco", mint_mark: "S", country: "United States", denomination: "One Dollar", serial_number: null, certification_service: "none", certification_grade: null, cert_number: null, estimated_grade: "AU-58", condition: "Light wear on cheek", search_query: "1881-S Morgan Dollar", confidence: 0.8, unclear: null };
    const text = JSON.stringify(ident); res.setHeader("content-type", "application/x-ndjson");
    for (let i = 0; i < text.length; i += 40) res.write(JSON.stringify({ message: { content: text.slice(i, i + 40) }, done: false }) + "\n");
    res.end(JSON.stringify({ message: { content: "" }, done: true }) + "\n");
  });
}).listen(11434);
