import fs from "node:fs";
import path from "node:path";

import type { Department, IssueType, ReportStatus } from "./constants";
import { getDb, useMongo } from "./mongo";
import type { PlatformStats, ReportRecord, StatusHistoryRecord } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

type Store = {
  reports: ReportRecord[];
  statusHistory: StatusHistoryRecord[];
  nextHistoryId: number;
};

function defaultStore(): Store {
  return { reports: [], statusHistory: [], nextHistoryId: 1 };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): Store {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) {
    const store = defaultStore();
    writeStore(store);
    return store;
  }

  const raw = fs.readFileSync(STORE_PATH, "utf-8");
  return JSON.parse(raw) as Store;
}

function writeStore(store: Store) {
  ensureDataDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

function mutateStore<T>(fn: (store: Store) => T): T {
  const store = readStore();
  const result = fn(store);
  writeStore(store);
  return result;
}

async function nextHistoryIdMongo(): Promise<number> {
  const db = await getDb();
  const result = await db.collection<{ _id: string; seq: number }>("counters").findOneAndUpdate(
    { _id: "statusHistory" },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  return result?.seq ?? 1;
}

export async function generateTicketId(): Promise<string> {
  if (await useMongo()) {
    const db = await getDb();
    let id: string;
    do {
      id = `CIV-${Math.floor(100000 + Math.random() * 900000)}`;
      const exists = await db.collection("reports").findOne({ id }, { projection: { _id: 1 } });
      if (!exists) return id;
    } while (true);
  }

  const store = readStore();
  let id: string;
  do {
    id = `CIV-${Math.floor(100000 + Math.random() * 900000)}`;
  } while (store.reports.some((report) => report.id === id));
  return id;
}

export async function insertReport(input: {
  id: string;
  issueType: IssueType;
  description: string;
  imagePath: string;
  lat: number;
  lng: number;
  locationLabel: string;
  visionScore: number;
  nlpScore: number;
  finalScore: number;
  routed: boolean;
  department: Department;
  status: ReportStatus;
  statusNote?: string;
  isMultiIssue?: boolean;
  issueBreakdown?: ReportRecord["issueBreakdown"];
  notifiedDepartments?: Department[];
}): Promise<ReportRecord> {
  const now = new Date().toISOString();

  if (await useMongo()) {
    const db = await getDb();
    const report: ReportRecord = {
      id: input.id,
      issueType: input.issueType,
      description: input.description,
      imagePath: input.imagePath,
      lat: input.lat,
      lng: input.lng,
      locationLabel: input.locationLabel,
      visionScore: input.visionScore,
      nlpScore: input.nlpScore,
      finalScore: input.finalScore,
      routed: input.routed,
      department: input.department,
      status: input.status,
      isMultiIssue: input.isMultiIssue,
      issueBreakdown: input.issueBreakdown,
      notifiedDepartments: input.notifiedDepartments,
      createdAt: now,
      updatedAt: now,
    };

    const historyId = await nextHistoryIdMongo();
    const history: StatusHistoryRecord = {
      id: historyId,
      reportId: input.id,
      status: input.status,
      note: input.statusNote ?? "Report submitted and analyzed",
      createdAt: now,
    };

    await db.collection("reports").insertOne(report);
    await db.collection("statusHistory").insertOne(history);
    return report;
  }

  return mutateStore((store) => {
    const report: ReportRecord = {
      id: input.id,
      issueType: input.issueType,
      description: input.description,
      imagePath: input.imagePath,
      lat: input.lat,
      lng: input.lng,
      locationLabel: input.locationLabel,
      visionScore: input.visionScore,
      nlpScore: input.nlpScore,
      finalScore: input.finalScore,
      routed: input.routed,
      department: input.department,
      status: input.status,
      isMultiIssue: input.isMultiIssue,
      issueBreakdown: input.issueBreakdown,
      notifiedDepartments: input.notifiedDepartments,
      createdAt: now,
      updatedAt: now,
    };

    store.reports.unshift(report);
    store.statusHistory.push({
      id: store.nextHistoryId++,
      reportId: input.id,
      status: input.status,
      note: input.statusNote ?? "Report submitted and analyzed",
      createdAt: now,
    });

    return report;
  });
}

export async function addStatusHistory(
  reportId: string,
  status: ReportStatus,
  note?: string,
): Promise<void> {
  const createdAt = new Date().toISOString();

  if (await useMongo()) {
    const db = await getDb();
    const historyId = await nextHistoryIdMongo();
    await db.collection("statusHistory").insertOne({
      id: historyId,
      reportId,
      status,
      note: note ?? null,
      createdAt,
    });
    return;
  }

  mutateStore((store) => {
    store.statusHistory.push({
      id: store.nextHistoryId++,
      reportId,
      status,
      note: note ?? null,
      createdAt,
    });
  });
}

export async function getReportById(id: string): Promise<ReportRecord | null> {
  if (await useMongo()) {
    const db = await getDb();
    return db.collection<ReportRecord>("reports").findOne({ id });
  }
  return readStore().reports.find((report) => report.id === id) ?? null;
}

export async function getStatusHistory(reportId: string): Promise<StatusHistoryRecord[]> {
  if (await useMongo()) {
    const db = await getDb();
    return db
      .collection<StatusHistoryRecord>("statusHistory")
      .find({ reportId })
      .sort({ createdAt: 1 })
      .toArray();
  }
  return readStore()
    .statusHistory.filter((entry) => entry.reportId === reportId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function listReports(filters?: {
  status?: ReportStatus;
  department?: Department;
  limit?: number;
}): Promise<ReportRecord[]> {
  if (await useMongo()) {
    const db = await getDb();
    const query: Record<string, unknown> = {};
    if (filters?.status) query.status = filters.status;
    if (filters?.department) {
      query.$or = [
        { department: filters.department },
        { notifiedDepartments: filters.department },
      ];
    }
    const limit = filters?.limit ?? 100;
    return db
      .collection<ReportRecord>("reports")
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  let reports = readStore().reports;

  if (filters?.status) {
    reports = reports.filter((report) => report.status === filters.status);
  }
  if (filters?.department) {
    reports = reports.filter(
      (report) =>
        report.department === filters.department ||
        report.notifiedDepartments?.includes(filters.department!),
    );
  }

  reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return reports.slice(0, filters?.limit ?? 100);
}

export async function updateReportStatus(
  id: string,
  status: ReportStatus,
  note?: string,
): Promise<ReportRecord | null> {
  if (await useMongo()) {
    const db = await getDb();
    const updatedAt = new Date().toISOString();
    const report = await db.collection<ReportRecord>("reports").findOneAndUpdate(
      { id },
      { $set: { status, updatedAt } },
      { returnDocument: "after" },
    );
    if (!report) return null;

    const historyId = await nextHistoryIdMongo();
    await db.collection("statusHistory").insertOne({
      id: historyId,
      reportId: id,
      status,
      note: note ?? null,
      createdAt: updatedAt,
    });

    return report;
  }

  return mutateStore((store) => {
    const report = store.reports.find((item) => item.id === id);
    if (!report) return null;

    report.status = status;
    report.updatedAt = new Date().toISOString();
    store.statusHistory.push({
      id: store.nextHistoryId++,
      reportId: id,
      status,
      note: note ?? null,
      createdAt: report.updatedAt,
    });

    return { ...report };
  });
}

async function allReports(): Promise<ReportRecord[]> {
  if (await useMongo()) {
    const db = await getDb();
    return db.collection<ReportRecord>("reports").find({}).toArray();
  }
  return readStore().reports;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const reports = await allReports();
  const total = reports.length;

  if (total === 0) {
    return { totalReports: 0, autoRouteRate: 0, avgLatencyMs: 0, resolvedCount: 0 };
  }

  const routed = reports.filter((report) => report.routed).length;
  const resolved = reports.filter((report) =>
    ["resolved", "closed"].includes(report.status),
  ).length;

  return {
    totalReports: total,
    autoRouteRate: Math.round((routed / total) * 1000) / 10,
    avgLatencyMs: 1800,
    resolvedCount: resolved,
  };
}

function departmentsForReport(report: ReportRecord): Department[] {
  if (report.notifiedDepartments?.length) return report.notifiedDepartments;
  return [report.department];
}

export async function getDepartmentQueueCounts(): Promise<Map<Department, number>> {
  const counts = new Map<Department, number>();
  const reports = await allReports();
  for (const report of reports) {
    if (report.status === "routed" || report.status === "in_progress") {
      for (const department of departmentsForReport(report)) {
        counts.set(department, (counts.get(department) ?? 0) + 1);
      }
    }
  }
  return counts;
}

export async function getManualReviewReports(limit = 10): Promise<ReportRecord[]> {
  return listReports({ status: "manual_review", limit });
}

export async function seedDemoReports(): Promise<void> {
  if (await useMongo()) {
    const db = await getDb();
    const existing = await db.collection("reports").estimatedDocumentCount();
    if (existing > 0) return;

    const now = new Date().toISOString();
    const samples = demoSampleReports(now);
    const history: StatusHistoryRecord[] = [];

    for (const sample of samples) {
      history.push({
        id: await nextHistoryIdMongo(),
        reportId: sample.id,
        status: sample.status,
        note: "Seeded demo ticket for manual review",
        createdAt: now,
      });
    }

    await db.collection("reports").insertMany(samples);
    await db.collection("statusHistory").insertMany(history);
    return;
  }

  const store = readStore();
  if (store.reports.length > 0) return;

  const now = new Date().toISOString();
  for (const sample of demoSampleReports(now)) {
    store.reports.push(sample);
    store.statusHistory.push({
      id: store.nextHistoryId++,
      reportId: sample.id,
      status: sample.status,
      note: "Seeded demo ticket for manual review",
      createdAt: now,
    });
  }

  writeStore(store);
}

function demoSampleReports(now: string): ReportRecord[] {
  const samples = [
    {
      id: "CIV-204188",
      issueType: "manhole" as IssueType,
      description: "Open manhole cover near school crossing.",
      department: "Sewer Maintenance" as Department,
      status: "manual_review" as ReportStatus,
      routed: false,
      visionScore: 0.41,
      nlpScore: 0.52,
      finalScore: 0.44,
    },
    {
      id: "CIV-204192",
      issueType: "garbage" as IssueType,
      description: "Large garbage pile blocking sidewalk.",
      department: "Sanitation" as Department,
      status: "manual_review" as ReportStatus,
      routed: false,
      visionScore: 0.38,
      nlpScore: 0.49,
      finalScore: 0.41,
    },
    {
      id: "CIV-204203",
      issueType: "pothole" as IssueType,
      description: "Deep pothole with conflicting traffic reports.",
      department: "Public Works" as Department,
      status: "manual_review" as ReportStatus,
      routed: false,
      visionScore: 0.43,
      nlpScore: 0.4,
      finalScore: 0.42,
    },
  ];

  return samples.map((sample) => ({
    ...sample,
    imagePath: "/uploads/demo-placeholder.jpg",
    lat: 28.6139,
    lng: 77.209,
    locationLabel: "Sector 14, Civic Zone",
    createdAt: now,
    updatedAt: now,
  }));
}
