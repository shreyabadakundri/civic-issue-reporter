import { DEPARTMENTS, ISSUE_META, type IssueType, type ReportStatus } from "./constants";
import type { PlatformStats, ReportRecord } from "./types";

export type AdminAnalytics = {
  stats: PlatformStats;
  byStatus: Record<ReportStatus, number>;
  byDepartment: Record<(typeof DEPARTMENTS)[number], number>;
  byIssueType: Record<IssueType, number>;
  multiIssueCount: number;
  avgConfidencePct: number;
  autoRoutedCount: number;
  manualReviewCount: number;
  timeline: Array<{ date: string; count: number; label: string }>;
  diagnosisFeed: Array<{
    id: string;
    issueLabel: string;
    issueType: IssueType;
    isMultiIssue: boolean;
    breakdown?: string;
    confidencePct: number;
    status: ReportStatus;
    department: string;
    createdAt: string;
  }>;
};

export function buildAdminAnalytics(reports: ReportRecord[], stats: PlatformStats): AdminAnalytics {
  const byStatus = {
    submitted: 0,
    routed: 0,
    manual_review: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
  } satisfies Record<ReportStatus, number>;

  const byDepartment = Object.fromEntries(DEPARTMENTS.map((d) => [d, 0])) as AdminAnalytics["byDepartment"];
  const byIssueType: Record<IssueType, number> = { pothole: 0, garbage: 0, manhole: 0 };

  let confidenceSum = 0;
  let multiIssueCount = 0;
  let autoRoutedCount = 0;

  for (const report of reports) {
    byStatus[report.status]++;
    byIssueType[report.issueType]++;
    confidenceSum += report.finalScore;
    if (report.isMultiIssue) multiIssueCount++;
    if (report.routed) autoRoutedCount++;

    for (const dept of DEPARTMENTS) {
      if (report.department === dept || report.notifiedDepartments?.includes(dept)) {
        byDepartment[dept]++;
      }
    }
  }

  const dayMap = new Map<string, number>();
  for (const report of reports) {
    const day = report.createdAt.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }

  const sortedDays = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  const timeline = sortedDays.map(([date, count]) => ({
    date,
    count,
    label: new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }));

  const diagnosisFeed = [...reports]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12)
    .map((report) => ({
      id: report.id,
      issueLabel: report.isMultiIssue ? "Multiple issues" : ISSUE_META[report.issueType].label,
      issueType: report.issueType,
      isMultiIssue: Boolean(report.isMultiIssue),
      breakdown: report.issueBreakdown
        ?.map((b) => `${ISSUE_META[b.issueType].label} ${b.percentage}%`)
        .join(" · "),
      confidencePct: Math.round(report.finalScore * 100),
      status: report.status,
      department: report.isMultiIssue
        ? (report.notifiedDepartments?.join(", ") ?? report.department)
        : report.department,
      createdAt: report.createdAt,
    }));

  return {
    stats,
    byStatus,
    byDepartment,
    byIssueType,
    multiIssueCount,
    avgConfidencePct: reports.length ? Math.round((confidenceSum / reports.length) * 100) : 0,
    autoRoutedCount,
    manualReviewCount: byStatus.manual_review,
    timeline,
    diagnosisFeed,
  };
}
