# Silver Vault

A private register for your silver, gold, coins, rounds and bars. Photograph both sides of a piece. Silver Vault identifies it, catalogs its full specifications, researches what it has actually sold for recently, and values your whole collection against live spot prices. It runs on your Mac, and you use it from the Mac's browser or from Safari on your iPhone.

## What it does

- **Identify from photos.** Reads year, mint and mint mark, metal, fineness, weight, fine content, diameter, catalogue number, mintage, and grade or slab details. It tells you when a closer photo is needed.
- **Appraise from real sales.** Researches recent sold listings, auction results and dealer bid/ask prices. You get a fair value, a low–high range, and every comparable sale it used, with links.
- **Live spot prices.** Silver, gold, platinum and palladium refresh every 30 seconds. Bullion values move with spot, keeping the premium from the last appraisal. Collector coins keep their appraised value until you refresh them.
- **Organize.** Search by year, mint, grade, tag or storage location. Filter by type and metal, and sort by value, gain, weight, date added or name. See portfolio value, cost basis, gain, melt value, and total silver and gold ounces at a glance.
- **Sell well.** Each piece has a shareable sell sheet. You can export everything to CSV for insurance or taxes, and refresh stale appraisals in the background.

## Setup on your Mac (one time, about 15 minutes)

### 1. Get an Anthropic API key
1. Sign up at **https://console.anthropic.com**.
2. Under **Billing**, add credit. $10–20 lasts a long time: an identification costs a few cents, and an appraisal roughly 10–50 cents.
3. Under **API Keys**, click **Create Key** and copy it. It starts with `sk-ant-`.

### 2. Install Node.js
Download the **LTS** installer from **https://nodejs.org** and run it with the default options.

### 3. Download Silver Vault
On **https://github.com/giasone44/silver-vault**, click the green **Code** button, then **Download ZIP**. Move the unzipped folder into **Documents** and rename it `silver-vault`.

### 4. Start it
Double-click **`Start Silver Vault.command`** in that folder.

- **If macOS says it can't verify the file:** open  → **System Settings** → **Privacy & Security**, scroll down, click **Open Anyway** next to "Start Silver Vault.command", and confirm. You only need to do this once.
- **On the first run** it asks for your API key, installs what it needs, and builds the app. This takes a few minutes. After that it starts in seconds.

Silver Vault opens in your browser, already connected.

### 5. Connect your iPhone
The Terminal window shows a **QR code**. With the iPhone on the same Wi-Fi, point the **Camera** app at the code and tap the link. Safari opens Silver Vault already connected. Then tap **Share → Add to Home Screen** so it opens like an app.

## Everyday use

- **Start:** double-click `Start Silver Vault.command`. Keep its Terminal window open while you use the app; your Mac won't go to sleep while it's running.
- **Stop:** close the Terminal window, or press Control-C in it.
- **Add a piece:** tap the gold **+**, photograph the front and back, and tap **Identify piece**. Check the details, add what you paid, and save. The appraisal runs automatically and takes about a minute.
- **Update appraisals:** open a piece and tap **Refresh report**, or use **Settings → Refresh stale reports** to update everything older than 24 hours.

## Your data

Everything is kept in the **`Silver Vault`** folder in your home folder (Finder → Go → Home):

| File | What it is |
|---|---|
| `vault.db` | Your collection, appraisals and price history |
| `photos/` | Your photographs |
| `config.env` | Your API key and connection password |

It's separate from the downloaded code, so you can replace the `silver-vault` folder with a newer download at any time without losing anything. Time Machine backs it up automatically. For an extra copy, use **Settings → Export register · CSV**.

## Optional extras

- **Use it away from home.** Install **Tailscale** (free for personal use, https://tailscale.com) on both the Mac and the iPhone, and sign in to the same account on each. The Terminal window then also shows an "Away from home" link that works anywhere, privately. Your Mac still needs to be on.
- **Richer eBay data.** Create a free developer account at https://developer.ebay.com and add `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` to `config.env`. Current eBay listings then feed into each appraisal. To open the file, run `open -e ~/"Silver Vault/config.env"` in Terminal. Actual *sold* data from eBay's API requires eBay's approval (Marketplace Insights). Until then, sold prices come from web research.
- **A cheaper AI model.** Add `CLAUDE_MODEL=claude-sonnet-5-5` to `config.env`.

## How values are calculated

- **Melt** = fine troy ounces × live spot.
- **Bullion pieces:** the appraised value is adjusted live by the change in spot since the appraisal, times the fine ounces.
- **Numismatic pieces:** the appraised value holds until the next refresh.
- **Pieces not yet appraised** show melt value and are marked *Unvalued*.
- Every appraisal is kept, so each piece has a value history.

## For developers

| Path | What it is |
|---|---|
| `server/` | Node + TypeScript API (Hono, built-in SQLite). Holds the key and the data, and serves the web app. `npm start` reads `server/.env`; see `server/.env.example`. |
| `app/` | Expo / React Native app for iPhone and web. Screens are in `app/src/app/`. `npm run build:web` builds the web version; `npx expo start` runs it in Expo Go. |
