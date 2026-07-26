import fs from "node:fs";
import path from "node:path";

import type { Department, IssueType, ReportStatus } from "./constants";
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

export function generateTicketId() {
  const store = readStore();
  let id: string;
  do {
    id = `CIV-${Math.floor(100000 + Math.random() * 900000)}`;
  } while (store.reports.some((report) => report.id === id));
  return id;
}

export function insertReport(input: {
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
}) {
  const now = new Date().toISOString();

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

export function addStatusHistory(reportId: string, status: ReportStatus, note?: string) {
  mutateStore((store) => {
    store.statusHistory.push({
      id: store.nextHistoryId++,
      reportId,
      status,
      note: note ?? null,
      createdAt: new Date().toISOString(),
    });
  });
}

export function getReportById(id: string): ReportRecord | null {
  return readStore().reports.find((report) => report.id === id) ?? null;
}

export function getStatusHistory(reportId: string): StatusHistoryRecord[] {
  return readStore()
    .statusHistory.filter((entry) => entry.reportId === reportId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function listReports(filters?: {
  status?: ReportStatus;
  department?: Department;
  limit?: number;
}) {
  let reports = readStore().reports;

  if (filters?.status) {
    reports = reports.filter((report) => report.status === filters.status);
  }
  if (filters?.department) {
    reports = reports.filter((report) => report.department === filters.department);
  }

  reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return reports.slice(0, filters?.limit ?? 100);
}

export function updateReportStatus(
  id: string,
  status: ReportStatus,
  note?: string,
): ReportRecord | null {
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

export function getPlatformStats(): PlatformStats {
  const reports = readStore().reports;
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

export function getDepartmentQueueCounts() {
  const counts = new Map<Department, number>();
  for (const report of readStore().reports) {
    if (report.status === "routed" || report.status === "in_progress") {
      counts.set(report.department, (counts.get(report.department) ?? 0) + 1);
    }
  }
  return counts;
}

export function getManualReviewReports(limit = 10) {
  return listReports({ status: "manual_review", limit });
}

export function seedDemoReports() {
  const store = readStore();
  if (store.reports.length > 0) return;

  const now = new Date().toISOString();
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

  for (const sample of samples) {
    store.reports.push({
      ...sample,
      imagePath: "/uploads/demo-placeholder.jpg",
      lat: 28.6139,
      lng: 77.209,
      locationLabel: "Sector 14, Civic Zone",
      createdAt: now,
      updatedAt: now,
    });
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
