#!/bin/bash
# Double-click to start Silver Vault on this Mac.
#
# First run: asks for your Anthropic API key, installs what it needs and
# builds the app. After that it just starts. Your settings, database and
# photos live in ~/Silver Vault, outside this folder, so replacing this
# folder with a newer download never touches your collection.

cd "$(dirname "$0")" || exit 1
ROOT="$PWD"
DATA="$HOME/Silver Vault"
CONF="$DATA/config.env"
PORT=8787

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
  KEY=$(osascript -e 'text returned of (display dialog "Paste your Anthropic API key.\n\nIt starts with sk-ant- and comes from console.anthropic.com → API Keys." default answer "" with title "Silver Vault setup" with hidden answer)' 2>/dev/null)
  KEY=$(echo "$KEY" | tr -d '[:space:]')
  case "$KEY" in
    sk-ant-*) ;;
    *) fail "That doesn't look like an Anthropic API key (it should start with sk-ant-). Double-click this file to try again." ;;
  esac
  cat > "$CONF" <<EOF
# Silver Vault settings. Edit with: open -e "$CONF"
ANTHROPIC_API_KEY="$KEY"
# Password your devices use to connect (entered automatically via the QR code).
APP_TOKEN="$(openssl rand -hex 16)"
DATA_DIR="$DATA"

# Optional - see README.md
# SPOT_PROVIDER=gold-api
# SPOT_API_KEY=
# EBAY_CLIENT_ID=
# EBAY_CLIENT_SECRET=
# EBAY_MARKETPLACE_INSIGHTS=false
EOF
  chmod 600 "$CONF"
  echo "  Settings saved to $CONF"
fi
TOKEN=$(grep '^APP_TOKEN=' "$CONF" | cut -d= -f2- | tr -d '"')

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
