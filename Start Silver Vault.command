#!/bin/bash
# Double-click to set up (or update) Silver Vault on this Mac.
#
# It installs what it needs, builds the app, and then hands Silver Vault to
# macOS to run in the background: it starts by itself whenever you log in, so
# you never need Terminal again. Just open it on your iPhone.
#
# Your settings, database and photos live in ~/Silver Vault, outside this
# folder, so replacing this folder with a newer download never touches your
# collection. Run this file again after downloading a new version to update.
#
# To stop the automatic start, double-click "Stop Silver Vault.command".

DATA="$HOME/Silver Vault"
CONF="$DATA/config.env"
PROG="$DATA/program"
LOG="$DATA/silver-vault.log"
LABEL="com.silvervault.server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PORT=8787
OLLAMA_URL="http://127.0.0.1:11434"

# --- Background mode: started by macOS at login (see the plist below) ---------
if [ "$1" = "--service" ]; then
  cd "$PROG/server" || exit 1
  # Keep the log from growing without limit.
  [ -f "$LOG" ] && [ "$(wc -c <"$LOG")" -gt 5000000 ] && tail -c 1000000 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
  # caffeinate -s keeps the Mac awake while it's plugged in, so your iPhone can always reach it.
  exec caffeinate -s node --no-warnings --env-file="$CONF" --import tsx src/index.ts
fi

cd "$(dirname "$0")" || exit 1
ROOT="$PWD"

fail() {
  echo
  echo "  $1"
  echo
  read -n 1 -s -r -p "  Press any key to close this window."
  echo
  exit 1
}

echo
echo "  S I L V E R   V A U L T"
echo

# --- Node.js -----------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  open "https://nodejs.org/en/download"
  fail "Node.js isn't installed. Its download page just opened: install the LTS version, then double-click this file again."
fi
if ! node -e "require('node:sqlite')" >/dev/null 2>&1; then
  open "https://nodejs.org/en/download"
  fail "Your Node.js ($(node -v)) is too old. Install the current LTS version from the page that just opened, then try again."
fi
NODE_DIR="$(dirname "$(command -v node)")"

# --- First-time settings -------------------------------------------------------
mkdir -p "$DATA"
if [ ! -f "$CONF" ]; then
  echo "  First-time setup."
  NUMISTA=$(osascript \
    -e 'set r to display dialog "Optional: paste a free Numista API key.

It fills in exact coin specifications, mintages and price guides. Get one at numista.com/api, or click Skip and add it later." default answer "" with title "Silver Vault setup" buttons {"Skip", "Save"} default button "Save"' \
    -e 'if button returned of r is "Save" then return text returned of r' 2>/dev/null | tr -d '[:space:]')
  cat > "$CONF" <<EOF
# Silver Vault settings. Edit with: open -e "$CONF"
# Password your devices use to connect (entered automatically via the QR code).
APP_TOKEN="$(openssl rand -hex 16)"
DATA_DIR="$DATA"

# Free coin catalogue - exact specs and price guides (numista.com/api)
NUMISTA_API_KEY="$NUMISTA"

# Claude (best accuracy): paste your key in the app under Settings, or here.
# ANTHROPIC_API_KEY=

# Free on-Mac AI, used only when no Claude key is set
OLLAMA_MODEL="qwen2.5vl:3b"

# Optional, free eBay developer keys (developer.ebay.com) - current listings as comparables
# EBAY_CLIENT_ID=
# EBAY_CLIENT_SECRET=
EOF
  chmod 600 "$CONF"
  echo "  Settings saved to $CONF"
fi
TOKEN=$(grep '^APP_TOKEN=' "$CONF" | cut -d= -f2- | tr -d '"')

# --- How to read photos: Claude (recommended) or the free on-Mac AI ------------
if ! grep -q '^ANTHROPIC_API_KEY=..' "$CONF" && ! grep -q '^AI_CHOICE=' "$CONF"; then
  CHOICE=$(osascript -e 'button returned of (display dialog "How should Silver Vault read your photos?

Claude (recommended): expert accuracy in seconds, and researches each piece online. About 2–5¢ per identification. You paste a key under Settings in Silver Vault afterwards.

Free on this Mac: slower and less accurate; downloads a 3 GB model." with title "Silver Vault setup" buttons {"Free on this Mac", "Claude"} default button "Claude")' 2>/dev/null)
  [ "$CHOICE" = "Free on this Mac" ] && echo 'AI_CHOICE="free"' >>"$CONF" || echo 'AI_CHOICE="claude"' >>"$CONF"
fi

# --- Free on-Mac AI (Ollama): only if chosen and no Claude key -----------------
if ! grep -q '^ANTHROPIC_API_KEY=..' "$CONF" && grep -q '^AI_CHOICE="free"' "$CONF"; then
  MODEL=$(grep '^OLLAMA_MODEL=' "$CONF" | cut -d= -f2- | tr -d '"')
  MODEL=${MODEL:-qwen2.5vl:3b}
  ollama_up() { curl -s -m 2 "$OLLAMA_URL/api/tags" >/dev/null; }
  model_ready() { curl -s -m 5 "$OLLAMA_URL/api/tags" | grep -q "\"name\":\"$MODEL\""; }
  if ! ollama_up; then
    if [ -d "/Applications/Ollama.app" ] || [ -d "$HOME/Applications/Ollama.app" ]; then
      echo "  Starting Ollama…"
      open -a Ollama
      for _ in $(seq 1 30); do ollama_up && break; sleep 1; done
    else
      open "https://ollama.com/download/mac"
      fail "The free on-Mac AI needs the Ollama app. Its download page just opened: install it (drag it into Applications and open it once), then double-click this file again."
    fi
  fi
  ollama_up || fail "Ollama didn't start. Open the Ollama app from Applications, then try again."
  if ! model_ready; then
    echo "  Downloading the photo-reading model ($MODEL, about 3 GB, one time only)…"
    curl -sN "$OLLAMA_URL/api/pull" -d "{\"model\":\"$MODEL\"}" \
      | grep --line-buffered -o '"status":"[^"]*"' \
      | while IFS= read -r line; do s=${line#\"status\":\"}; s=${s%\"}; [ "$s" != "$last" ] && echo "    $s"; last=$s; done
    model_ready || fail "The model download didn't finish. Check your internet connection and try again."
  fi
fi

# --- Install / build (only when something changed) ----------------------------
install_if_needed() {
  if [ ! -d "$1/node_modules" ] || [ "$1/package.json" -nt "$1/node_modules" ]; then
    echo "  Installing components for $1 (first run takes a minute)…"
    (cd "$ROOT/$1" && npm install --no-audit --no-fund --loglevel=error) || fail "Install failed in $1 - see the messages above."
    touch "$ROOT/$1/node_modules"
  fi
}
install_if_needed server
install_if_needed app

if [ ! -f app/dist/index.html ] || [ -n "$(find app/src app/package.json -newer app/dist/index.html 2>/dev/null | head -1)" ]; then
  echo "  Building the app…"
  (cd app && CI=1 npx expo export -p web >/dev/null) || fail "Building the app failed - see the messages above."
fi

# --- Hand over to macOS to run in the background ---------------------------------
echo "  Installing Silver Vault to run automatically…"
launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1
# An older copy running in a Terminal window would hold the port; stop it.
pkill -f "src/index.ts" >/dev/null 2>&1
sleep 1

# Run from ~/Silver Vault (macOS doesn't let background apps read Documents).
mkdir -p "$PROG"
rsync -a --delete --exclude .git "$ROOT/" "$PROG/" || fail "Couldn't copy Silver Vault into $PROG."

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$PROG/Start Silver Vault.command</string>
    <string>--service</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$NODE_DIR:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF
launchctl bootstrap "gui/$(id -u)" "$PLIST" || fail "macOS didn't accept the background service. Try running this file again."

echo "  Starting…"
for _ in $(seq 1 40); do
  curl -s -m 1 "http://localhost:$PORT/api/health" >/dev/null && break
  sleep 1
done
curl -s -m 2 "http://localhost:$PORT/api/health" >/dev/null || {
  echo
  tail -20 "$LOG"
  fail "Silver Vault didn't start. The lines above explain why; send a photo of them for help."
}

IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
LINK="http://$IP:$PORT/?t=$TOKEN"
open "http://localhost:$PORT/?t=$TOKEN"

echo
echo "  ✓ Silver Vault is running, and will start by itself whenever you log in."
echo "    Keep the Mac plugged in so it stays awake for your iPhone."
if [ -n "$IP" ]; then
  echo
  echo "  To connect your iPhone (same Wi-Fi): point the Camera at this code and tap the link."
  echo "  (The same code is in Silver Vault → Settings.)"
  echo
  (cd "$PROG/server" && node -e 'require("qrcode-terminal").generate(process.argv[1], { small: true }, (q) => console.log(q.replace(/^/gm, "  ")))' "$LINK")
  echo "  $LINK"
fi
echo
echo "  You can close this window."
echo
