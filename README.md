# Silver Vault

A private register for your silver, gold, coins, rounds and bars. It runs entirely on your Mac and **costs nothing to use**. Photograph both sides of a piece. Silver Vault reads it, catalogs its exact specifications, values it, and tracks your whole collection against live spot prices. Use it from the Mac's browser, or from Safari on your iPhone.

## What it does

- **Reads your photos, privately.** A free AI model runs on your Mac through the Ollama app and reads the year, mint mark, legends, fineness stamps and slab labels. Your photos never leave your Mac.
- **Exact specifications.** Pick the matching entry from the free Numista catalogue (the best match is chosen automatically). It fills in weight, fineness, fine content, diameter, catalogue number, designer and descriptions.
- **Makers.** A built-in register of mints and refiners covers private refiners (Engelhard, Johnson Matthey, Handy & Harman, PAMP, Valcambi, Credit Suisse, Heraeus, Degussa and more), US private mints (SilverTowne, Sunshine, Northwest Territorial and others), and government mints (US Mint, Royal Canadian Mint, Royal Mint, Perth, Austrian, Mexican, South African, China). Each piece shows its maker's history, what years it operated, and what collectors look for. Pieces are recognized even when misspelled ("Englehard", "Johnson Mathew"), and you can filter your collection by maker.
- **Mintages.** Each catalogued coin shows how many were struck for every year and mint mark, with yours highlighted and ranked by scarcity. Private bars have no published mintages; for those, rarity comes from variety, era and serial number.
- **Values.** Live melt value, Numista price guides for the specific year, mint and grade, and current eBay listings (optional). Every report lists its sources.
- **Live spot prices.** Silver, gold, platinum and palladium update every 30 seconds. Bullion values move with spot.
- **Organize.** Search by year, mint, grade, tag or storage location. Filter by type and metal, and sort by value, gain, weight, date added or name. See portfolio value, cost basis, gain, melt value, and total silver and gold ounces at a glance.
- **Sell well.** Each piece has a shareable sell sheet, and you can export everything to CSV for insurance or taxes.

## Install on your Mac (one command, about 5 minutes)

1. Install **Node.js** from **https://nodejs.org** (the **LTS** button; click Continue through the installer).
2. Open **Terminal** (press ⌘ + Space, type **Terminal**, press Enter), paste this line and press Enter:

   ```
   curl -fsSL https://raw.githubusercontent.com/giasone44/silver-vault/main/install.sh | bash
   ```

3. Answer the one or two questions it asks, and wait until it says **"All done"**. Close the window.

That's all. Silver Vault now starts by itself whenever you log in and **updates itself** automatically. You never need Terminal again. On your iPhone, scan the QR code it shows (also in **Settings**), then tap **Share → Add to Home Screen**.

## Setup on your Mac (one time, about 20 minutes)

Everything below is free.

### 1. Install Node.js
Download the **LTS** installer from **https://nodejs.org** and run it with the default options.

### 2. Install Ollama (the local AI)
Download Ollama from **https://ollama.com/download/mac**. Drag it into **Applications** and open it once, so its llama icon appears in the menu bar.

### 3. Optional: get a free Numista key (recommended)
It adds exact specifications and price guides.
1. Create a free account at **https://en.numista.com**.
2. Go to **https://en.numista.com/api/**, click to request an API key, and fill in the short form. Personal use is fine.
3. Copy the key. Setup will ask for it. You can also skip it and add it later.

### 4. Download Silver Vault
On **https://github.com/giasone44/silver-vault**, click the green **Code** button, then **Download ZIP**. Move the unzipped folder into **Documents** and rename it `silver-vault`.

### 5. Start it
Double-click **`Start Silver Vault.command`** in that folder.

- **If macOS says it can't verify the file:** open  → **System Settings** → **Privacy & Security**, scroll down, click **Open Anyway**, and confirm. You only need to do this once.
- **On the first run** it asks for your Numista key (or click **Skip**) and downloads the photo-reading model, about 3 GB. It also installs components and builds the app. Allow 10–20 minutes, depending on your internet connection. After that it starts in seconds.

Silver Vault opens in your browser, already connected.

### 6. Connect your iPhone
The Terminal window shows a **QR code**. With the iPhone on the same Wi-Fi, point the **Camera** app at it and tap the link. Then tap **Share → Add to Home Screen** so it opens like an app.

## Everyday use

- **It runs by itself.** After the first setup, Silver Vault starts in the background whenever you log in to your Mac. There's no Terminal window to keep open. Keep the Mac plugged in so it stays awake for your iPhone.
- **On your iPhone:** tap the Silver Vault icon on your home screen.
- **Add a piece:** tap the gold **+**, photograph both sides (either order is fine), then tap **Identify piece**. Add what you paid if you know it, then tap **Enter into register**. Its dossier (history, specifications, mintage, varieties, authenticity checks) and market value are researched automatically in the background.
- **A piece with missing information?** Open it and tap **Re-identify from photos**. What you paid, quantity and notes are kept.
- **Connect another phone:** open **Settings** in Silver Vault on your Mac and scan the QR code.
- **Update to a newer version:** download the new ZIP, replace the `silver-vault` folder in Documents, and double-click **Start Silver Vault.command** again.
- **Turn it off:** double-click **Stop Silver Vault.command**.

## Your data

Everything lives in the **`Silver Vault`** folder in your home folder (Finder → Go → Home):

| File | What it is |
|---|---|
| `vault.db` | Your collection, valuations and price history |
| `photos/` | Your photographs |
| `config.env` | Your settings and optional keys |

It's separate from the downloaded code, so you can replace the `silver-vault` folder with a newer download without losing anything. Time Machine backs it up automatically. For an extra copy, use **Settings → Export register · CSV**.

To change settings later, run `open -e ~/"Silver Vault/config.env"` in Terminal, edit the file, save, and restart Silver Vault.

## Optional extras (all free)

- **Use it away from home.** Install **Tailscale** (https://tailscale.com) on both the Mac and the iPhone, and sign in to the same account on each. The Terminal window then shows an "Away from home" link that works anywhere, as long as the Mac is on.
- **eBay listings as comparables.** Create a developer account at https://developer.ebay.com, create a production keyset, and add `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` to `config.env`.
- **A stronger local model.** On a Mac with 16 GB or more memory, set `OLLAMA_MODEL="qwen2.5vl:7b"` for more accurate readings.

## How values are calculated

Each valuation uses the best source available, in this order:

1. **Recent eBay sales.** Only used if your eBay keys have been approved for sold data.
2. **Numista price guide** for this year, mint mark and grade. Used for collector coins.
3. **Current eBay asking prices**, shaded down about 8%, because listings sell below their ask.
4. **Melt value** at live spot.

Every piece also has one-tap links to its **eBay sold listings** (what buyers actually paid) and its **Numista catalogue page**. This matters most for collectible bars such as vintage Engelhard or Johnson Matthey, where melt alone undervalues them.

Values never go below melt. Bullion values then move with spot between valuations; collector coins hold their value until you tap **Refresh report**. Every report states its sources and a confidence level.

## Best accuracy: Claude (recommended)

For expert-level identification in seconds, plus research of actual sold prices across the web, connect Claude. It costs about 2–5¢ per identification and 10–40¢ per market report, billed by Anthropic.

1. In Silver Vault, tap the **gear** (Settings).
2. Tap **1 · Get a key**. On Anthropic's site, sign in, add a little credit under **Billing**, and create a key.
3. Paste the key into **2 · Paste your key**, then tap **3 · Save**.

That's it. Identification and valuation switch to Claude immediately, and the free on-Mac AI is no longer needed.

## For developers

| Path | What it is |
|---|---|
| `server/` | Node + TypeScript API (Hono, built-in SQLite). Local AI via Ollama (`ollama.ts`), Numista catalogue and mintages (`numista.ts`), mint and refiner register (`makers.ts`), free valuation (`appraise.ts`), optional Claude (`ai.ts`). `npm start` reads `server/.env`. |
| `app/` | Expo / React Native app for iPhone and web. Screens are in `app/src/app/`. `npm run build:web` builds the web version. |
