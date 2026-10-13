import fs from "node:fs";
import path from "node:path";

import { loadEnvFile } from "../lib/env";
import { closeMongo, getDb, isMongoEnabled } from "../lib/mongo";
import type { ReportRecord, StatusHistoryRecord } from "../lib/types";

loadEnvFile();

type Store = {
  reports: ReportRecord[];
  statusHistory: StatusHistoryRecord[];
  nextHistoryId: number;
};

async function main() {
  if (!isMongoEnabled()) {
    console.error("Set MONGODB_URL in .env before migrating.");
    process.exit(1);
  }

  const storePath = path.join(process.cwd(), "data", "store.json");
  if (!fs.existsSync(storePath)) {
    console.error("No data/store.json found — nothing to migrate.");
    process.exit(1);
  }

  const store = JSON.parse(fs.readFileSync(storePath, "utf-8")) as Store;
  const db = await getDb();
  const dbName = db.databaseName;

  const reportsCol = db.collection<ReportRecord>("reports");
  const historyCol = db.collection<StatusHistoryRecord>("statusHistory");

  let reportsInserted = 0;
  let reportsSkipped = 0;
  for (const report of store.reports) {
    const result = await reportsCol.updateOne(
      { id: report.id },
      { $setOnInsert: report },
      { upsert: true },
    );
    if (result.upsertedCount) reportsInserted++;
    else reportsSkipped++;
  }

  let historyInserted = 0;
  let historySkipped = 0;
  for (const entry of store.statusHistory) {
    const result = await historyCol.updateOne(
      { id: entry.id },
      { $setOnInsert: entry },
      { upsert: true },
    );
    if (result.upsertedCount) historyInserted++;
    else historySkipped++;
  }

  const maxHistoryId = store.statusHistory.reduce((max, entry) => Math.max(max, entry.id), 0);
  const counterSeq = Math.max(store.nextHistoryId - 1, maxHistoryId);
  await db.collection<{ _id: string; seq: number }>("counters").updateOne(
    { _id: "statusHistory" },
    { $max: { seq: counterSeq } },
    { upsert: true },
  );

  const totalReports = await reportsCol.countDocuments();
  const totalHistory = await historyCol.countDocuments();

  console.log(`Database: ${dbName}`);
  console.log(
    `Reports: ${reportsInserted} inserted, ${reportsSkipped} skipped (already existed)`,
  );
  console.log(
    `Status history: ${historyInserted} inserted, ${historySkipped} skipped (already existed)`,
  );
  console.log(`Totals in Atlas — reports: ${totalReports}, statusHistory: ${totalHistory}`);

  await closeMongo();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
