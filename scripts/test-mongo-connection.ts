import { loadEnvFile } from "../lib/env";
import { closeMongo, getDb, isMongoEnabled } from "../lib/mongo";

loadEnvFile();

function logUriHints() {
  const uri = process.env.MONGODB_URI?.trim() ?? "";
  try {
    const parsed = new URL(uri.replace(/^mongodb(\+srv)?:/, "https:"));
    const user = decodeURIComponent(parsed.username);
    const hasPassword = parsed.password.length > 0;
    const host = parsed.host;
    console.error("Using username:", user || "(missing)");
    console.error("Using host:", host || "(missing)");
    console.error("Password in URI:", hasPassword ? "present" : "MISSING");
    if (
      parsed.password.includes("YOUR_") ||
      parsed.password === "<db_password>" ||
      parsed.password === "db_password"
    ) {
      console.error("Replace the placeholder password in MONGODB_URI with your Atlas Database Access password.");
    }
  } catch {
    console.error("MONGODB_URI could not be parsed — check for typos or spaces.");
  }
}

async function main() {
  if (!isMongoEnabled()) {
    console.error("Set MONGODB_URI in .env (Atlas → Connect → Drivers → copy connection string).");
    process.exit(1);
  }

  const db = await getDb();
  const ping = await db.command({ ping: 1 });
  console.log("Connected to MongoDB Atlas:", db.databaseName, ping);
  await closeMongo();
}

main().catch((err) => {
  console.error(err);
  if (err && typeof err === "object" && "codeName" in err && err.codeName === "AtlasError") {
    console.error("\nAtlas rejected the username/password.");
    console.error("Fix: Database Access → shreyabadakundri_db_user → EDIT → Edit Password → Update user");
    console.error("Then put that same password in .env MONGODB_URI (not your Gmail password).\n");
    logUriHints();
  }
  process.exit(1);
});
