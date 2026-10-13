import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
}

import { isSmtpConfigured, sendTestEmail } from "../lib/email";

async function main() {
  if (!isSmtpConfigured()) {
    console.error("\n❌ SMTP_PASS is missing in .env\n");
    console.log("1. Open https://myaccount.google.com/apppasswords");
    console.log("2. Create an App Password for Mail (16 characters)");
    console.log("3. Edit .env and set:  SMTP_PASS=yourapppassword");
    console.log("4. Run again:  npm run test:email\n");
    process.exit(1);
  }

  console.log("Sending test email to", process.env.NOTIFY_EMAIL_FALLBACK ?? process.env.SMTP_USER);
  const result = await sendTestEmail();
  if (result.ok) {
    console.log("✓ Sent! Check your Gmail inbox (and spam). Message id:", result.messageId);
    process.exit(0);
  }
  console.error("✗ Failed:", result.error);
  console.log("\nTip: Use a Google App Password, not your normal Gmail password.");
  process.exit(1);
}

main();
