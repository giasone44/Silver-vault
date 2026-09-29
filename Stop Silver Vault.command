#!/bin/bash
# Double-click to stop Silver Vault and turn off its automatic start.
# Your collection in ~/Silver Vault is kept. To start again, double-click
# "Start Silver Vault.command".

LABEL="com.silvervault.server"
launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
pkill -f "src/index.ts" >/dev/null 2>&1

echo
echo "  Silver Vault is stopped and won't start automatically."
echo "  Your collection is safe in the Silver Vault folder in your home folder."
echo
echo "  You can close this window."
echo
