import fs from "node:fs";
import path from "node:path";

import { loadEnvFile } from "../lib/env";
import { closeMongo, getDb, isMongoEnabled } from "../lib/mongo";

loadEnvFile();

async function main() {
  const storePath = path.join(process.cwd(), "data", "store.json");
  let localReports = 0;
  let localHistory = 0;
  if (fs.existsSync(storePath)) {
    const store = JSON.parse(fs.readFileSync(storePath, "utf-8")) as {
      reports?: unknown[];
      statusHistory?: unknown[];
    };
    localReports = store.reports?.length ?? 0;
    localHistory = store.statusHistory?.length ?? 0;
  }

  console.log("Local file (data/store.json):");
  console.log(`  reports: ${localReports}, statusHistory: ${localHistory}`);

  if (!isMongoEnabled()) {
    console.log("\nAtlas: MONGODB_URI not set — app uses local file only.");
    return;
  }

  try {
    const db = await getDb();
    const atlasReports = await db.collection("reports").countDocuments();
    const atlasHistory = await db.collection("statusHistory").countDocuments();
    console.log(`\nAtlas (${db.databaseName}):`);
    console.log(`  reports: ${atlasReports}, statusHistory: ${atlasHistory}`);
    if (localReports > 0 && atlasReports === 0) {
      console.log("\n→ App data is still local. Run: npm run test:mongo  then  npm run db:migrate");
    }
    await closeMongo();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("\nAtlas: could not connect —", msg);
    console.log("→ Fix password (.env) and Network Access, then restart npm run dev");
    if (localReports > 0) {
      console.log("→ Your reports exist locally until migration succeeds.");
    }
    process.exit(1);
  }
}

main();
