import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { ISSUE_META } from "./constants";
import type { Department } from "./constants";
import type { EmailOutboxRecord, IssueBreakdownItem } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const OUTBOX_PATH = path.join(DATA_DIR, "email-outbox.json");

type OutboxStore = { emails: EmailOutboxRecord[] };

function defaultDepartmentEmail(department: Department) {
  const map: Record<Department, string | undefined> = {
    "Public Works": process.env.DEPT_EMAIL_PUBLIC_WORKS,
    Sanitation: process.env.DEPT_EMAIL_SANITATION,
    "Sewer Maintenance": process.env.DEPT_EMAIL_SEWER,
  };
  return (
    map[department] ??
    process.env.NOTIFY_EMAIL_FALLBACK ??
    `${department.toLowerCase().replace(/\s+/g, ".")}@civicmind.local`
  );
}

function readOutbox(): OutboxStore {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(OUTBOX_PATH)) {
    const empty = { emails: [] };
    fs.writeFileSync(OUTBOX_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
  return JSON.parse(fs.readFileSync(OUTBOX_PATH, "utf-8")) as OutboxStore;
}

function writeOutbox(store: OutboxStore) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUTBOX_PATH, JSON.stringify(store, null, 2), "utf-8");
}

function buildEmailHtml(input: {
  reportId: string;
  department: Department;
  locationLabel: string;
  description: string;
  breakdown: IssueBreakdownItem[];
  deptShare?: IssueBreakdownItem;
}) {
  const rows = input.breakdown
    .map(
      (item) =>
        `<tr><td>${ISSUE_META[item.issueType].label}</td><td>${item.percentage}%</td><td>${item.department}</td></tr>`,
    )
    .join("");

  const focus = input.deptShare
    ? `<p><strong>Your department focus:</strong> ${ISSUE_META[input.deptShare.issueType].label} — ${input.deptShare.percentage}% of this incident.</p>`
    : "";

  return `<!DOCTYPE html><html><body style="font-family:sans-serif">
<h2>CivicMind AI — Department Alert</h2>
<p>Ticket <strong>${input.reportId}</strong> requires attention from <strong>${input.department}</strong>.</p>
${focus}
<p><strong>Location:</strong> ${input.locationLabel}</p>
<p><strong>Citizen report:</strong> ${input.description || "(photo-only submission)"}</p>
<h3>Detected issue mix</h3>
<table border="1" cellpadding="8" cellspacing="0"><tr><th>Issue</th><th>Share</th><th>Department</th></tr>${rows}</table>
<p>— CivicMind AI routing</p>
</body></html>`;
}

export function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  );
}

export async function trySmtpSend(to: string, subject: string, html: string) {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s/g, "");
  const from = process.env.SMTP_FROM?.trim() ?? user ?? "civicmind@notifications.local";

  if (!host || !user || !pass) {
    return { ok: false as const, error: "SMTP_HOST, SMTP_USER, and SMTP_PASS must be set in .env" };
  }

  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port === 587,
      auth: { user, pass },
    });
    await transport.verify();
    const info = await transport.sendMail({ from, to, subject, html });
    return { ok: true as const, messageId: info.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("SMTP send failed:", message);
    return { ok: false as const, error: message };
  }
}

export async function sendTestEmail() {
  const to = process.env.NOTIFY_EMAIL_FALLBACK ?? process.env.SMTP_USER ?? "";
  if (!to) {
    return { ok: false as const, error: "Set NOTIFY_EMAIL_FALLBACK or SMTP_USER in .env" };
  }

  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif">
<h2>CivicMind AI — Test Email</h2>
<p>If you received this, Gmail SMTP is configured correctly.</p>
<p>Time: ${new Date().toISOString()}</p>
</body></html>`;

  const result = await trySmtpSend(to, "[CivicMind] SMTP test — configuration OK", html);
  if (result.ok) {
    const store = readOutbox();
    store.emails.unshift({
      id: `EML-${crypto.randomBytes(4).toString("hex")}`,
      reportId: "SMTP-TEST",
      department: "Public Works",
      to,
      subject: "[CivicMind] SMTP test — configuration OK",
      html,
      createdAt: new Date().toISOString(),
      delivery: "smtp",
    });
    writeOutbox(store);
  }
  return result;
}

export function listEmailOutbox(limit = 50): EmailOutboxRecord[] {
  return readOutbox()
    .emails.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function notifyDepartmentsForReport(input: {
  reportId: string;
  locationLabel: string;
  description: string;
  breakdown: IssueBreakdownItem[];
  departments: Department[];
}) {
  const store = readOutbox();
  const now = new Date().toISOString();
  const created: EmailOutboxRecord[] = [];

  type PendingMail = {
    department: Department;
    to: string;
    subject: string;
    html: string;
    deptShare: IssueBreakdownItem;
  };

  const pending: PendingMail[] = input.departments.map((department) => {
    const deptShare =
      input.breakdown.find((item) => item.department === department) ?? input.breakdown[0];
    const to = defaultDepartmentEmail(department);
    const subject =
      input.departments.length > 1
        ? `[CivicMind] ${input.reportId} — multi-department alert @ ${input.locationLabel}`
        : `[CivicMind] ${input.reportId} — ${deptShare.percentage}% ${ISSUE_META[deptShare.issueType].label} @ ${input.locationLabel}`;
    const html = buildEmailHtml({
      reportId: input.reportId,
      department,
      locationLabel: input.locationLabel,
      description: input.description,
      breakdown: input.breakdown,
      deptShare,
    });
    return { department, to, subject, html, deptShare };
  });

  const byRecipient = new Map<string, PendingMail[]>();
  for (const mail of pending) {
    const list = byRecipient.get(mail.to) ?? [];
    list.push(mail);
    byRecipient.set(mail.to, list);
  }

  for (const [to, mails] of byRecipient) {
    const primary = mails[0];
    const subject =
      mails.length > 1
        ? `[CivicMind] ${input.reportId} — ${mails.length} departments notified @ ${input.locationLabel}`
        : primary.subject;
    const html =
      mails.length > 1
        ? buildEmailHtml({
            reportId: input.reportId,
            department: primary.department,
            locationLabel: input.locationLabel,
            description: input.description,
            breakdown: input.breakdown,
          })
        : primary.html;

    const smtpResult = await trySmtpSend(to, subject, html);

    for (const mail of mails) {
      const record: EmailOutboxRecord = {
        id: `EML-${crypto.randomBytes(4).toString("hex")}`,
        reportId: input.reportId,
        department: mail.department,
        to,
        subject,
        html: mail.html,
        createdAt: now,
        delivery: smtpResult.ok ? "smtp" : "outbox",
      };
      store.emails.unshift(record);
      created.push(record);
    }
  }

  writeOutbox(store);
  return created;
}
