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

import { classifyIssueFromDescription } from "../lib/ai";
import {
  buildIssueBreakdown,
  fuseModalityScores,
  scoresFromDescription,
  summarizeMultiIssue,
} from "../lib/multi-issue";
import { listEmailOutbox, notifyDepartmentsForReport } from "../lib/email";

async function main() {
  const description =
    "Huge garbage pile beside a deep pothole and a missing manhole cover blocking traffic.";

  console.log("--- Description classification ---");
  const classification = classifyIssueFromDescription(description);
  console.log("Primary:", classification.issueType, classification.confidence);

  const nlpScores = scoresFromDescription(description);
  const fused = fuseModalityScores({ nlp: nlpScores });
  const breakdown = buildIssueBreakdown(fused);
  const summary = summarizeMultiIssue(breakdown);

  console.log("\n--- Multi-issue summary ---");
  console.log("Multi:", summary.isMultiIssue);
  console.log("Departments:", summary.departments.join(", "));
  for (const item of summary.activeBreakdown) {
    console.log(`  ${item.issueType}: ${item.percentage}% → ${item.department}`);
  }

  const reportId = `TEST-${Date.now()}`;
  console.log("\n--- Email notifications ---");
  const emails = await notifyDepartmentsForReport({
    reportId,
    locationLabel: "Test Location, Sector 14",
    description,
    breakdown: summary.activeBreakdown,
    departments: summary.departments,
  });

  for (const email of emails) {
    console.log(`  ${email.delivery} → ${email.to} | ${email.subject.slice(0, 60)}...`);
  }

  const outbox = listEmailOutbox(5);
  console.log("\n--- Outbox (latest 5) ---");
  console.log("Total in outbox sample:", outbox.length);
  console.log("Latest to:", outbox[0]?.to, "| delivery:", outbox[0]?.delivery);

  console.log("\n✓ Flow OK (outbox always works; SMTP needs SMTP_PASS app password in .env)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
