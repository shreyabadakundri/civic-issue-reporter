import "../lib/env";

import { isSmtpConfigured, sendTestEmail } from "../lib/email";

async function main() {
  if (!isSmtpConfigured()) {
    console.error("\n❌ SMTP is not configured in env/civicmind.config\n");
    console.log("1. Open https://myaccount.google.com/apppasswords");
    console.log("2. Turn on 2-Step Verification if needed");
    console.log("3. Create an App Password for Mail (16 characters, no spaces)");
    console.log("4. Set SMTP_PASS=thatpassword in env/civicmind.config");
    console.log("5. Run again:  npm run test:email\n");
    process.exit(1);
  }

  const user = process.env.SMTP_USER?.trim() ?? "";
  const passLen = (process.env.SMTP_PASS ?? "").replace(/\s/g, "").length;
  console.log("SMTP_USER:", user || "(missing)");
  console.log("SMTP_PASS length:", passLen, passLen === 16 ? "(ok for App Password)" : "(expected 16)");

  const to = process.env.NOTIFY_EMAIL_ADMIN ?? process.env.NOTIFY_EMAIL_FALLBACK ?? process.env.SMTP_USER;
  console.log("Sending test email to", to);
  const result = await sendTestEmail();
  if (result.ok) {
    console.log("✓ Sent! Check Gmail inbox (and spam). Message id:", result.messageId);
    process.exit(0);
  }
  console.error("✗ Failed:", result.error);
  console.log("\nTip: Use a Google App Password in SMTP_PASS, not your normal Gmail password.");
  process.exit(1);
}

main();
