import { MongoClient, ServerApiVersion, type Db } from "mongodb";

import "./env";

let client: MongoClient | null = null;
let db: Db | null = null;
let mongoReachable = false;

export function getMongoUri(): string | undefined {
  return process.env.MONGODB_URL?.trim() || undefined;
}

export function isMongoEnabled(): boolean {
  return Boolean(getMongoUri());
}

export function resetMongoConnection() {
  mongoReachable = false;
  db = null;
  if (client) {
    void client.close().catch(() => {});
    client = null;
  }
}

/** True when MONGODB_URL is set and Atlas accepts the credentials (cached after success). */
export async function useMongo(): Promise<boolean> {
  if (!isMongoEnabled()) return false;
  if (mongoReachable && db) return true;

  try {
    await getDb();
    mongoReachable = true;
    return true;
  } catch (err) {
    resetMongoConnection();
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[mongo] Could not connect (${msg}). Using local data/store.json until MONGODB_URL is fixed.`,
    );
    return false;
  }
}

function mongoClientOptions() {
  return {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: false,
      deprecationErrors: false,
    },
    serverSelectionTimeoutMS: 25_000,
    connectTimeoutMS: 25_000,
    socketTimeoutMS: 45_000,
    maxPoolSize: 10,
    // Prefer IPv4 — helps on some college/corp networks with broken IPv6
    family: 4 as const,
  };
}

async function ensureIndexes(database: Db) {
  await database.collection("reports").createIndex({ id: 1 }, { unique: true });
  await database.collection("reports").createIndex({ createdAt: -1 });
  await database.collection("reports").createIndex({ status: 1 });
  await database.collection("statusHistory").createIndex({ reportId: 1, createdAt: 1 });
}

export async function getDb(): Promise<Db> {
  const uri = getMongoUri();
  if (!uri) {
    throw new Error("MONGODB_URL is not set");
  }

  if (db) return db;

  resetMongoConnection();
  client = new MongoClient(uri, mongoClientOptions());
  await client.connect();
  const name = process.env.MONGODB_DB_NAME?.trim() || "civicmind";
  db = client.db(name);
  await ensureIndexes(db);
  return db;
}

export async function closeMongo(): Promise<void> {
  resetMongoConnection();
}
