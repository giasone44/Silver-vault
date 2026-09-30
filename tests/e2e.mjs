import { chromium } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:8788";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const problems = [];
p.on("pageerror", (e) => problems.push("page error: " + e));
p.on("console", (m) => m.type() === "error" && !/favicon/.test(m.text()) && problems.push("console: " + m.text()));
p.on("response", (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()} ${r.url()}`));
p.on("dialog", (d) => { console.log("  dialog:", d.message().split("\n")[0]); d.accept(); });
const step = async (name, fn) => { try { await fn(); console.log("PASS", name); } catch (e) { console.log("FAIL", name, "-", String(e).split("\n")[0]); problems.push(name); await p.screenshot({ path: `fail-${name.replace(/\W+/g, "_")}.png` }); } };
const see = (t, timeout = 15000) => p.getByText(t, { exact: false }).first().waitFor({ timeout });

await step("open app with pairing link", async () => { await p.goto(BASE + "/?t=t"); await see("The vault awaits"); });
await step("home-screen icon opens the app already connected", async () => {
  const href = await p.locator('link[rel="manifest"]').getAttribute("href");
  const m = await (await fetch(new URL(href, BASE))).json();
  if (m.display !== "standalone" || m.start_url !== "/?t=t") throw new Error(`manifest ${JSON.stringify(m)}`);
  const icon = await p.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  const r = await fetch(new URL(icon, BASE));
  if (!r.ok || r.headers.get("content-type") !== "image/png") throw new Error(`icon ${r.status}`);
});
await step("add: identify from photos", async () => {
  await p.getByText("＋", { exact: false }).first().click().catch(() => p.goto(BASE + "/add"));
  await p.goto(BASE + "/add"); await see("Photograph both faces");
  for (const label of ["+  Obverse", "+  Reverse"]) { const [fc] = await Promise.all([p.waitForEvent("filechooser"), p.getByText(label).click()]); await fc.setFiles(new URL("./coin-silver.png", import.meta.url).pathname); await p.waitForTimeout(800); }
  await p.getByText("Identify piece").click();
  await see("1964 Kennedy Half Dollar", 30000);
});
await step("add: enter price paid and save", async () => {
  await p.getByText("Paid per piece ($)").locator("xpath=following-sibling::input").fill("25");
  await p.getByText("Enter into register").click();
  await see("Present value", 20000);
});
await step("research: dossier and market value appear", async () => {
  await see("Dossier", 40000);
  await see("first year of the series", 5000);
  await see("Trades near melt", 20000);
});
await step("collection lists the piece with a value", async () => {
  await p.goto(BASE + "/"); await see("1964 Kennedy Half Dollar");
  const txt = await p.locator("body").innerText();
  if (!/\$2\d\.\d\d/.test(txt)) throw new Error("no value shown");
});
await step("search finds it; unrelated search hides it", async () => {
  const s = p.getByPlaceholder(/Search maker/);
  await s.fill("kennedy"); await see("1964 Kennedy Half Dollar");
  await s.fill("engelhard"); await see("Nothing matches");
  await s.fill("");
});
await step("edit quantity", async () => {
  await p.getByText("1964 Kennedy Half Dollar").first().click(); await see("Present value");
  await p.getByText("AMEND").click(); await see("Your details");
  await p.getByText("How many").locator("xpath=following-sibling::input").fill("3");
  await p.getByText("Save amendments").click(); await see("3 pieces", 15000);
});
await step("re-identify from photos keeps price paid", async () => {
  await p.getByText("Re-identify from photos").click();
  await see("Researching", 20000).catch(() => {});
  await see("Trades near melt", 40000);
  const txt = await p.locator("body").innerText();
  if (!txt.includes("$25.00")) throw new Error("price paid lost");
});
await step("settings: Claude connected, QR shown", async () => {
  await p.goto(BASE + "/settings"); await see("Connected"); await see("Connect your iPhone");
});
await step("delete piece", async () => {
  await p.goto(BASE + "/"); await p.getByText("1964 Kennedy Half Dollar").first().click(); await see("Present value");
  await p.getByText("Remove from register").click(); await see("The vault awaits", 15000);
});
console.log(problems.length ? "PROBLEMS:\n  " + problems.join("\n  ") : "NO PROBLEMS");
await b.close();
