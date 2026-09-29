#!/bin/bash
# Double-click to start Silver Vault on this Mac.
#
# First run: checks for the free Ollama app (local AI), downloads the photo-
# reading model, optionally asks for a free Numista catalogue key, installs
# what it needs and builds the app. After that it just starts. Your settings,
# database and photos live in ~/Silver Vault, outside this folder, so
# replacing this folder with a newer download never touches your collection.

cd "$(dirname "$0")" || exit 1
ROOT="$PWD"
DATA="$HOME/Silver Vault"
CONF="$DATA/config.env"
PORT=8787
OLLAMA_URL="http://127.0.0.1:11434"

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

# --- Already running? ----------------------------------------------------------
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "  Silver Vault is already running - opening it."
  open "http://localhost:$PORT"
  exit 0
fi

# --- First-time settings -------------------------------------------------------
mkdir -p "$DATA"
if [ ! -f "$CONF" ]; then
  echo "  First-time setup."
  NUMISTA=$(osascript \
    -e 'set r to display dialog "Optional: paste a free Numista API key.

It fills in exact coin specifications and price guides. Get one at numista.com/api, or click Skip and add it later." default answer "" with title "Silver Vault setup" buttons {"Skip", "Save"} default button "Save"' \
    -e 'if button returned of r is "Save" then return text returned of r' 2>/dev/null | tr -d '[:space:]')
  cat > "$CONF" <<EOF
# Silver Vault settings. Edit with: open -e "$CONF"
# Password your devices use to connect (entered automatically via the QR code).
APP_TOKEN="$(openssl rand -hex 16)"
DATA_DIR="$DATA"

# Free coin catalogue - exact specs and price guides (numista.com/api)
NUMISTA_API_KEY="$NUMISTA"

# Local AI model (free, runs on this Mac through Ollama)
OLLAMA_MODEL="qwen2.5vl:3b"

# Optional, free eBay developer keys (developer.ebay.com) - current listings as comparables
# EBAY_CLIENT_ID=
# EBAY_CLIENT_SECRET=

# Optional, paid: an Anthropic API key switches to Claude for better reading and web price research
# ANTHROPIC_API_KEY=
EOF
  chmod 600 "$CONF"
  echo "  Settings saved to $CONF"
fi
TOKEN=$(grep '^APP_TOKEN=' "$CONF" | cut -d= -f2- | tr -d '"')
MODEL=$(grep '^OLLAMA_MODEL=' "$CONF" | cut -d= -f2- | tr -d '"')
MODEL=${MODEL:-qwen2.5vl:3b}

# --- Local AI (Ollama) - skipped if a paid Anthropic key is configured -----------
ollama_up() { curl -s -m 2 "$OLLAMA_URL/api/tags" >/dev/null; }
model_ready() { curl -s -m 5 "$OLLAMA_URL/api/tags" | grep -q "\"name\":\"$MODEL\""; }

if ! grep -q '^ANTHROPIC_API_KEY=..' "$CONF"; then
  if ! ollama_up; then
    if [ -d "/Applications/Ollama.app" ] || [ -d "$HOME/Applications/Ollama.app" ]; then
      echo "  Starting Ollama…"
      open -a Ollama
      for _ in $(seq 1 30); do ollama_up && break; sleep 1; done
    else
      open "https://ollama.com/download/mac"
      fail "Silver Vault uses the free Ollama app to read your photos privately on this Mac. Its download page just opened: install it (drag it into Applications and open it once), then double-click this file again."
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

# --- Run -----------------------------------------------------------------------
(sleep 3 && open "http://localhost:$PORT/?t=$TOKEN") &
cd server || exit 1
# caffeinate keeps the Mac from sleeping (and dropping your iPhone) while this runs.
exec caffeinate -i node --no-warnings --env-file="$CONF" --import tsx src/index.ts
