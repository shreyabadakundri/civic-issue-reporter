import fs from "node:fs";
import path from "node:path";

let loaded = false;

function applyEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    // Always trust env/civicmind.config (avoids stale empty SMTP_* from the shell)
    process.env[key] = value;
  }
}

/**
 * Load secrets from `env/local.env` (edit this file), then optional root `.env`.
 * Vite dev also benefits when `vite.config.ts` imports this module.
 */
export function loadEnvFile() {
  if (loaded) return;
  loaded = true;

  const root = process.cwd();
  // Single secrets file (one MONGODB_URL — edit env/civicmind.config only)
  applyEnvFile(path.join(root, "env", "civicmind.config"));
}

loadEnvFile();
