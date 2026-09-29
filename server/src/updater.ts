import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Silver Vault keeps itself up to date from GitHub. The actual work (download,
// install, rebuild, restart) is done by the launcher's --update mode, which
// runs on its own so it can restart this server when it's finished.

const REPO = "giasone44/silver-vault";
const PROGRAM_DIR = path.resolve(process.cwd(), "..");
const LAUNCHER = path.join(PROGRAM_DIR, "Start Silver Vault.command");
const VERSION_FILE = path.join(PROGRAM_DIR, ".version");
const CHECK_EVERY_MS = 6 * 3600_000;

/** Only when running as the background service installed by the launcher. */
export const autoUpdates = process.env.SV_SERVICE === "1" && fs.existsSync(LAUNCHER);

let lastStarted = 0;

export function currentVersion(): string | null {
  try {
    return fs.readFileSync(VERSION_FILE, "utf8").trim() || null;
  } catch {
    return null;
  }
}

export async function latestVersion(): Promise<{ sha: string | null; isPrivate: boolean }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, {
      headers: { Accept: "application/vnd.github.sha", "User-Agent": "silver-vault" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) return { sha: null, isPrivate: true };
    return { sha: res.ok ? (await res.text()).trim() : null, isPrivate: false };
  } catch {
    return { sha: null, isPrivate: false };
  }
}

/** Starts an update in the background; it restarts Silver Vault if there was anything new. */
export function startUpdate(): boolean {
  if (!autoUpdates) return false;
  if (Date.now() - lastStarted < 10 * 60_000) return true; // one at a time
  lastStarted = Date.now();
  spawn("/bin/bash", [LAUNCHER, "--update"], { detached: true, stdio: "ignore", cwd: PROGRAM_DIR }).unref();
  return true;
}

export function scheduleUpdates() {
  if (!autoUpdates) return;
  setTimeout(startUpdate, 2 * 60_000);
  setInterval(startUpdate, CHECK_EVERY_MS);
}
