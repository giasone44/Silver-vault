#!/bin/bash
# Sets up Silver Vault on this Mac. Easiest way to run it (Terminal):
#
#   curl -fsSL https://raw.githubusercontent.com/giasone44/silver-vault/main/install.sh | bash
#
# It installs what it needs, builds the app, then hands Silver Vault to macOS
# to run in the background: it starts by itself at login and updates itself
# from GitHub, so after this you never need Terminal again.
#
# Your settings, database and photos live in ~/Silver Vault. The program lives
# in ~/Silver Vault/program. To turn everything off, run
# "Stop Silver Vault.command".

REPO="giasone44/silver-vault"
DATA="$HOME/Silver Vault"
CONF="$DATA/config.env"
PROG="$DATA/program"
LOG="$DATA/silver-vault.log"
LABEL="com.silvervault.server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PORT=8787
OLLAMA_URL="http://127.0.0.1:11434"

# --- Shared steps ----------------------------------------------------------------

# Latest commit on GitHub (empty if offline or the project is private).
latest_version() {
  curl -fsS -m 15 -H "Accept: application/vnd.github.sha" "https://api.github.com/repos/$REPO/commits/main" 2>/dev/null
}

# Download the latest code into $PROG (keeps installed components).
fetch_latest() {
  local tmp top
  tmp="$(mktemp -d)"
  curl -fsSL -m 600 "https://codeload.github.com/$REPO/zip/refs/heads/main" -o "$tmp/sv.zip" || return 1
  unzip -q "$tmp/sv.zip" -d "$tmp" || return 1
  top="$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -1)"
  rsync -a --delete --exclude node_modules --exclude .version "$top/" "$PROG/" || return 1
  rm -rf "$tmp"
}

# Install components when their list changed, and build the app when needed.
install_and_build() {
  local d
  for d in server app; do
    if ! cmp -s "$PROG/$d/package-lock.json" "$PROG/$d/node_modules/.sv-lock"; then
      echo "  Installing components for $d (takes a minute)…"
      (cd "$PROG/$d" && npm install --no-audit --no-fund --loglevel=error) || return 1
      cp "$PROG/$d/package-lock.json" "$PROG/$d/node_modules/.sv-lock"
    fi
  done
  if [ ! -f "$PROG/app/dist/index.html" ] || [ -n "$(find "$PROG/app/src" -newer "$PROG/app/dist/index.html" 2>/dev/null | head -1)" ]; then
    echo "  Building the app…"
    (cd "$PROG/app" && CI=1 npx expo export -p web >/dev/null) || return 1
  fi
}

# --- Background mode: started by macOS at login --------------------------------
if [ "$1" = "--service" ]; then
  cd "$PROG/server" || exit 1
  [ -f "$LOG" ] && [ "$(wc -c <"$LOG")" -gt 5000000 ] && tail -c 1000000 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
  # caffeinate -s keeps the Mac awake while it's plugged in, so your iPhone can always reach it.
  exec caffeinate -s node --no-warnings --env-file="$CONF" --import tsx src/index.ts
fi

# --- Update mode: run by Silver Vault itself (at startup, every few hours, or from Settings)
if [ "$1" = "--update" ]; then
  exec >>"$DATA/update.log" 2>&1
  LATEST="$(latest_version)"
  [ -z "$LATEST" ] && { echo "$(date): can't reach GitHub (offline, or the project is private)"; exit 0; }
  [ "$LATEST" = "$(cat "$PROG/.version" 2>/dev/null)" ] && exit 0
  echo "$(date): updating to $LATEST"
  fetch_latest || { echo "download failed"; exit 1; }
  install_and_build || { echo "install/build failed"; exit 1; }
  echo "$LATEST" >"$PROG/.version"
  echo "$(date): updated; restarting"
  launchctl kickstart -k "gui/$(id -u)/$LABEL"
  exit 0
fi

# --- Interactive setup -------------------------------------------------------------
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

if ! command -v node >/dev/null 2>&1; then
  open "https://nodejs.org/en/download"
  fail "Node.js isn't installed. Its download page just opened: install the LTS version, then run this again."
fi
if ! node -e "require('node:sqlite')" >/dev/null 2>&1; then
  open "https://nodejs.org/en/download"
  fail "Your Node.js ($(node -v)) is too old. Install the current LTS version from the page that just opened, then run this again."
fi
NODE_DIR="$(dirname "$(command -v node)")"

# First-time settings.
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
EOF
  chmod 600 "$CONF"
fi
TOKEN=$(grep '^APP_TOKEN=' "$CONF" | cut -d= -f2- | tr -d '"')

# How to read photos: Claude (recommended) or the free on-Mac AI.
if ! grep -q '^ANTHROPIC_API_KEY=..' "$CONF" && ! grep -q '^AI_CHOICE=' "$CONF"; then
  CHOICE=$(osascript -e 'button returned of (display dialog "How should Silver Vault read your photos?

Claude (recommended): expert accuracy in seconds, and researches each piece online. About 2–5¢ per identification. You paste a key under Settings in Silver Vault afterwards.

Free on this Mac: slower and less accurate; downloads a 3 GB model." with title "Silver Vault setup" buttons {"Free on this Mac", "Claude"} default button "Claude")' 2>/dev/null)
  [ "$CHOICE" = "Free on this Mac" ] && echo 'AI_CHOICE="free"' >>"$CONF" || echo 'AI_CHOICE="claude"' >>"$CONF"
fi

# Free on-Mac AI (Ollama): only if chosen and no Claude key.
if ! grep -q '^ANTHROPIC_API_KEY=..' "$CONF" && grep -q '^AI_CHOICE="free"' "$CONF"; then
  MODEL=$(grep '^OLLAMA_MODEL=' "$CONF" | cut -d= -f2- | tr -d '"')
  MODEL=${MODEL:-qwen2.5vl:3b}
  ollama_up() { curl -s -m 2 "$OLLAMA_URL/api/tags" >/dev/null; }
  model_ready() { curl -s -m 5 "$OLLAMA_URL/api/tags" | grep -q "\"name\":\"$MODEL\""; }
  if ! ollama_up; then
    if [ -d "/Applications/Ollama.app" ] || [ -d "$HOME/Applications/Ollama.app" ]; then
      open -a Ollama
      for _ in $(seq 1 30); do ollama_up && break; sleep 1; done
    else
      open "https://ollama.com/download/mac"
      fail "The free on-Mac AI needs the Ollama app. Its download page just opened: install it, open it once, then run this again."
    fi
  fi
  ollama_up || fail "Ollama didn't start. Open the Ollama app from Applications, then run this again."
  if ! model_ready; then
    echo "  Downloading the photo-reading model ($MODEL, about 3 GB, one time only)…"
    curl -sN "$OLLAMA_URL/api/pull" -d "{\"model\":\"$MODEL\"}" \
      | grep --line-buffered -o '"status":"[^"]*"' \
      | while IFS= read -r line; do s=${line#\"status\":\"}; s=${s%\"}; [ "$s" != "$last" ] && echo "    $s"; last=$s; done
    model_ready || fail "The model download didn't finish. Check your internet connection and try again."
  fi
fi

# Stop any older copy (background service, or one running in a Terminal window).
launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1
pkill -f "src/index.ts" >/dev/null 2>&1
sleep 1

# The program runs from ~/Silver Vault/program (macOS doesn't let background
# apps read Documents). If this copy came from a download elsewhere, copy it in.
mkdir -p "$PROG"
if [ "$ROOT" != "$PROG" ]; then
  rsync -a --delete --exclude node_modules --exclude .git --exclude .version "$ROOT/" "$PROG/" || fail "Couldn't copy Silver Vault into $PROG."
fi
install_and_build || fail "Setting up failed - see the messages above."
[ -f "$PROG/.version" ] || echo "manual" >"$PROG/.version"

# Hand over to macOS: start at login, restart if it ever stops.
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
  <dict>
    <key>PATH</key><string>$NODE_DIR:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>SV_SERVICE</key><string>1</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF
launchctl bootstrap "gui/$(id -u)" "$PLIST" || fail "macOS didn't accept the background service. Run this again."

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
echo "  ✓ Silver Vault is running. It starts by itself whenever you log in, and"
echo "    keeps itself up to date. Keep the Mac plugged in so it stays awake."
if [ -n "$IP" ]; then
  echo
  echo "  To connect your iPhone (same Wi-Fi): point the Camera at this code and tap the link."
  echo "  (The same code is in Silver Vault → Settings.)"
  echo
  (cd "$PROG/server" && node -e 'require("qrcode-terminal").generate(process.argv[1], { small: true }, (q) => console.log(q.replace(/^/gm, "  ")))' "$LINK")
  echo "  $LINK"
fi
echo
echo "  All done. You can close this window."
echo
