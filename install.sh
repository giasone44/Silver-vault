#!/bin/bash
# Silver Vault one-line installer for macOS. Paste into Terminal:
#
#   curl -fsSL https://raw.githubusercontent.com/giasone44/silver-vault/main/install.sh | bash
#
# Downloads the latest version into ~/Silver Vault/program and runs the setup,
# which makes Silver Vault start by itself at login and keep itself updated.
set -e

REPO="giasone44/silver-vault"
PROG="$HOME/Silver Vault/program"
TMP="$(mktemp -d)"

echo
echo "  Downloading Silver Vault…"
curl -fsSL "https://codeload.github.com/$REPO/zip/refs/heads/main" -o "$TMP/sv.zip"
unzip -q "$TMP/sv.zip" -d "$TMP"
TOP="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -1)"

mkdir -p "$PROG"
rsync -a --delete --exclude node_modules --exclude .version "$TOP/" "$PROG/"
# GitHub stores the commit id as the zip comment; remember which version this is.
unzip -z "$TMP/sv.zip" | tail -1 | tr -d '[:space:]' > "$PROG/.version"
rm -rf "$TMP"

exec bash "$PROG/Start Silver Vault.command" < /dev/tty
