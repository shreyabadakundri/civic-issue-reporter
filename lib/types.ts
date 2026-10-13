import type { Department, IssueType, ReportStatus } from "./constants";

export type IssueBreakdownItem = {
  issueType: IssueType;
  percentage: number;
  confidence: number;
  department: Department;
  routed: boolean;
};

export type ReportRecord = {
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
  /** Latest status history note (e.g. manual review reason). */
  lastStatusNote?: string;
  isMultiIssue?: boolean;
  issueBreakdown?: IssueBreakdownItem[];
  notifiedDepartments?: Department[];
  createdAt: string;
  updatedAt: string;
};

export type EmailOutboxRecord = {
  id: string;
  reportId: string;
  department: Department;
  to: string;
  subject: string;
  html: string;
  createdAt: string;
  delivery: "smtp" | "outbox";
};

export type StatusHistoryRecord = {
  id: number;
  reportId: string;
  status: ReportStatus;
  note: string | null;
  createdAt: string;
};

export type AnalysisResult = {
  issueType: IssueType;
  vision: number;
  nlp: number;
  final: number;
  routed: boolean;
  department: Department;
  ticketId: string;
  location: { lat: number; lng: number; label: string };
  status: ReportStatus;
  imageUrl: string;
  isMultiIssue?: boolean;
  issueBreakdown?: IssueBreakdownItem[];
  notifiedDepartments?: Department[];
  emailsSent?: number;
};

export type PlatformStats = {
  totalReports: number;
  autoRouteRate: number;
  avgLatencyMs: number;
  resolvedCount: number;
};

export type DepartmentQueue = {
  department: Department;
  activeQueue: number;
  incoming: boolean;
  latestTicket?: {
    id: string;
    locationLabel: string;
  };
};

export type ImageClassificationResult = {
  issueType: IssueType;
  confidence: number;
  reason: string;
  usedCloudVision: boolean;
  modelSource: "cohere" | "openai" | "local" | "heuristic";
  alternatives: Array<{ issueType: IssueType; confidence: number }>;
  perClassScores?: Record<IssueType, number>;
};
