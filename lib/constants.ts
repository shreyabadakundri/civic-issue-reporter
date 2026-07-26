export type IssueType = "pothole" | "garbage" | "manhole";

export type ReportStatus =
  | "submitted"
  | "routed"
  | "manual_review"
  | "in_progress"
  | "resolved"
  | "closed";

export const ROUTING_THRESHOLD = 0.45;
export const VISION_WEIGHT = 0.7;
export const NLP_WEIGHT = 0.3;

export const ISSUE_META: Record<
  IssueType,
  {
    label: string;
    department: string;
    baseVision: number;
    baseNlp: number;
    color: string;
    keywords: string[];
  }
> = {
  pothole: {
    label: "Pothole",
    department: "Public Works",
    baseVision: 0.88,
    baseNlp: 0.72,
    color: "from-amber-400 to-orange-500",
    keywords: ["pothole", "road", "crack", "asphalt", "damage", "bump", "street", "crater"],
  },
  garbage: {
    label: "Garbage Pileup",
    department: "Sanitation",
    baseVision: 0.82,
    baseNlp: 0.78,
    color: "from-emerald-400 to-teal-500",
    keywords: ["garbage", "trash", "waste", "litter", "dump", "rubbish", "smell", "pile"],
  },
  manhole: {
    label: "Manhole Defect",
    department: "Sewer Maintenance",
    baseVision: 0.79,
    baseNlp: 0.68,
    color: "from-sky-400 to-blue-500",
    keywords: ["manhole", "sewer", "drain", "cover", "sinkhole", "open", "missing", "broken"],
  },
};

export const DEPARTMENTS = [
  "Public Works",
  "Sanitation",
  "Sewer Maintenance",
] as const;

export type Department = (typeof DEPARTMENTS)[number];
