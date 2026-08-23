import type { Department, IssueType, ReportStatus } from "./constants";

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
  createdAt: string;
  updatedAt: string;
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
};
