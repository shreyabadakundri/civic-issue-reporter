import fs from "node:fs";
import path from "node:path";

let loaded = false;

/** Load `.env` from project root (idempotent). Vite also loads it in dev; this covers scripts and SSR edge cases. */
export function loadEnvFile() {
  if (loaded) return;
  loaded = true;

  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
