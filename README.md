# Silver Vault

Photograph both sides of a coin, round or bar. Silver Vault identifies it, catalogs its full specifications, researches what it has actually sold for recently, and values your whole inventory against live spot prices. It runs on iPhone and in a desktop browser, and both see the same data.

```
 iPhone app (Expo)  ─┐
                     ├──►  Silver Vault server  ──►  Claude (photo ID + sold-price research)
 Desktop browser  ───┘     (your data + photos)  ──►  Spot price API (refreshed every 30 s)
                                                 ──►  eBay API (optional)
```

## What it does

- **Photo identification.** Takes the obverse and reverse photos and returns name, year, mint and mint mark, metal, purity, gross and fine weight, diameter, catalog number, mintage, and a description of each side. For slabs it reads the grading service, grade and cert number. For raw coins it gives an estimated grade and condition notes. It also tells you when a better photo is needed, for example "mint mark not visible".
- **Market value from actual sales.** Searches recent sold listings, auction records and dealer buy/sell prices for that exact item. It returns a fair value, a low–high range, dealer bid and ask, a confidence level, and every comparable sale it used, each with a link.
- **Live spot pricing.** Silver, gold, platinum and palladium prices refresh automatically. Bullion values move with spot using the premium found in the last market research. Numismatic values stay fixed until you refresh them.
- **Inventory.** Search by name, year, mint, grade, tag or storage location. Filter by type or metal. Sort by value, gain %, metal ounces, date added or name. The summary shows portfolio value, cost basis, gain, total melt value, and total silver and gold ounces.
- **Selling.** "Share sell sheet" builds a listing-ready summary with specs, grade, recent comparable sales and current spot. You can export everything to CSV for insurance or tax records. A background job re-researches any values older than 24 hours.

## Project layout

| Path | What it is |
|---|---|
| `server/` | Node + TypeScript API (Hono, built-in SQLite). Holds your API keys, database and photos. It also serves the desktop web app. |
| `app/` | Expo / React Native app for iPhone and web. Screens are in `app/src/app/`. |

## Setup

### 1. Server

```bash
cd server
npm install
cp .env.example .env      # then fill in ANTHROPIC_API_KEY and APP_TOKEN
npm start                 # http://localhost:8787
```

Requires Node 22.13 or later (it uses the built-in `node:sqlite`).

- **`ANTHROPIC_API_KEY`** (required). Create one at console.anthropic.com.
- **`APP_TOKEN`** (required). A long random password you choose. You enter the same value in the app.
- **Spot prices.** Works with no key by default (gold-api.com). To use metals.dev or goldapi.io instead, set `SPOT_PROVIDER` and `SPOT_API_KEY`.
- **eBay** (optional). Add `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` from developer.eBay.com to feed current eBay listings into each valuation. Actual *sold* data from eBay's API (Marketplace Insights) requires eBay to approve your app. Once approved, set `EBAY_MARKETPLACE_INSIGHTS=true`. Until then, sold prices come from Claude's web research.

### 2. Desktop

```bash
cd app && npm install && npm run build:web
```

Then open the server's URL (e.g. http://localhost:8787) in any browser, go to Settings, and enter your `APP_TOKEN`.

### 3. iPhone

**To try it today:** install **Expo Go** from the App Store, then:

```bash
cd app && npx expo start
```

Scan the QR code with the iPhone camera. In the app's Settings, set the server URL to your computer's LAN address (for example `http://192.168.1.20:8787`) and enter your token. The phone has to be on the same Wi-Fi.

**To use it anywhere:** deploy the server somewhere reachable. Any host with a persistent disk works (Railway, Render, Fly.io, a VPS, or a home machine with Tailscale). Point the app at that URL.

**To install it as a real app, or publish it:** use EAS Build. You don't need a Mac.

```bash
cd app
npx eas-cli@latest build -p ios --profile preview   # installable build for your own phone
npx eas-cli@latest submit -p ios                    # App Store / TestFlight
```

This requires an Apple Developer account ($99/year). Change `ios.bundleIdentifier` in `app/app.json` to your own identifier first.

## How values are calculated

- **Melt** = fine troy oz × live spot.
- **Market value** comes from the most recent research. For items classed as bullion, the value is `researched value + (spot now − spot at research) × fine oz`, so it tracks the market between refreshes. Numismatic items hold their researched value.
- Items that have never been researched show melt value and are marked "not valued".
- Every research run is saved, so each item keeps a value history.

## Running costs (rough)

Each identification is one Claude vision call, typically a few cents. Each market research runs several web searches plus page reads, so expect on the order of tens of cents per item. Refreshing a large inventory daily adds up, which is why the background refresh only re-researches values older than 24 hours. You can switch `CLAUDE_MODEL` to `claude-sonnet-5-5` in `.env` for a cheaper model.

## Before selling this commercially

The current build is designed for one owner: one server, one shared token. Commercial use needs:

1. **User accounts.** Sign in with Apple is required on iOS if you offer any other social login. Each user's items need to be kept separate. Add a `user_id` to items and replace `APP_TOKEN` with per-user sessions.
2. **Hosted database and photo storage.** Postgres plus S3 or R2, instead of SQLite and local disk.
3. **Billing.** Apple requires in-app purchase for digital subscriptions sold in the app. Rate-limit the AI endpoints per user so costs can't run away.
4. **Data licensing.** Check the terms of whichever spot provider you use for commercial redistribution. eBay's API license also governs how its data can be displayed.
5. **Disclaimers.** Present values as estimates, not appraisals.
