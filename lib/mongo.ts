import { MongoClient, type Db } from "mongodb";

import { loadEnvFile } from "./env";

loadEnvFile();

let client: MongoClient | null = null;
let db: Db | null = null;
let mongoReachable: boolean | null = null;

export function isMongoEnabled(): boolean {
  return Boolean(process.env.MONGODB_URI?.trim());
}

/** True when MONGODB_URI is set and Atlas accepts the credentials (cached after first attempt). */
export async function useMongo(): Promise<boolean> {
  if (!isMongoEnabled()) return false;
  if (mongoReachable === false) return false;
  if (mongoReachable === true) return true;

  try {
    await getDb();
    mongoReachable = true;
    return true;
  } catch (err) {
    mongoReachable = false;
    if (client) {
      await client.close().catch(() => {});
      client = null;
      db = null;
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[mongo] Could not connect (${msg}). Using local data/store.json until MONGODB_URI is fixed.`,
    );
    return false;
  }
}

async function ensureIndexes(database: Db) {
  await database.collection("reports").createIndex({ id: 1 }, { unique: true });
  await database.collection("reports").createIndex({ createdAt: -1 });
  await database.collection("reports").createIndex({ status: 1 });
  await database.collection("statusHistory").createIndex({ reportId: 1, createdAt: 1 });
}

export async function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  if (db) return db;

  client = new MongoClient(uri);
  await client.connect();
  const name = process.env.MONGODB_DB_NAME?.trim() || "civicmind";
  db = client.db(name);
  await ensureIndexes(db);
  return db;
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
