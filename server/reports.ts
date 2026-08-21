import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { analyzeReport, classifyIssueFromImage } from "@/lib/ai";
import { DEPARTMENTS, ISSUE_META, type Department, type IssueType, type ReportStatus } from "@/lib/constants";
import {
  generateTicketId,
  getDepartmentQueueCounts,
  getManualReviewReports,
  getPlatformStats,
  getReportById,
  getStatusHistory,
  insertReport,
  listReports,
  seedDemoReports,
  updateReportStatus,
} from "@/lib/db";
import { ensureDemoPlaceholder, saveImageFromFile } from "@/lib/storage";
import type { AnalysisResult, DepartmentQueue, ImageClassificationResult, PlatformStats, ReportRecord } from "@/lib/types";

const issueTypeSchema = z.enum(["pothole", "garbage", "manhole"]);
const statusSchema = z.enum([
  "submitted",
  "routed",
  "manual_review",
  "in_progress",
  "resolved",
  "closed",
]);

const submitReportFieldsSchema = z.object({
  issueType: issueTypeSchema.optional(),
  manualOverride: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters"),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  locationLabel: z.string().trim().min(3, "Location label is required"),
});

async function fileToBase64(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString("base64");
}

function parseImageFromFormData(data: FormData) {
  const image = data.get("image");
  if (!(image instanceof File) || image.size === 0) {
    throw new Error("Image upload is required");
  }
  return image;
}

function bootstrapDb() {
  ensureDemoPlaceholder();
  seedDemoReports();
}

function toAnalysisResult(report: ReportRecord): AnalysisResult {
  return {
    issueType: report.issueType,
    vision: report.visionScore,
    nlp: report.nlpScore,
    final: report.finalScore,
    routed: report.routed,
    department: report.department,
    ticketId: report.id,
    location: {
      lat: report.lat,
      lng: report.lng,
      label: report.locationLabel,
    },
    status: report.status,
    imageUrl: report.imagePath,
  };
}

export const getStats = createServerFn({ method: "GET" }).handler(async (): Promise<PlatformStats> => {
  bootstrapDb();
  return getPlatformStats();
});

export const getQueues = createServerFn({ method: "GET" }).handler(async () => {
  bootstrapDb();
  const counts = getDepartmentQueueCounts();
  const manualReview = getManualReviewReports(10);

  const departments: DepartmentQueue[] = DEPARTMENTS.map((department) => ({
    department,
    activeQueue: counts.get(department) ?? 0,
    incoming: false,
  }));

  return { departments, manualReview: manualReview.map(toAnalysisResult) };
});

export const classifyReportImage = createServerFn({ method: "POST" })
  .validator((formData: FormData) => formData)
  .handler(async ({ data }): Promise<ImageClassificationResult> => {
    const image = parseImageFromFormData(data);
    const description = data.get("description");
    const imageBase64 = await fileToBase64(image);

    return classifyIssueFromImage({
      imageBase64,
      mimeType: image.type || "image/jpeg",
      fileName: image.name,
      description: typeof description === "string" ? description : undefined,
    });
  });

export const submitReport = createServerFn({ method: "POST" })
  .validator((formData: FormData) => formData)
  .handler(async ({ data }): Promise<AnalysisResult> => {
    bootstrapDb();

    const image = parseImageFromFormData(data);
    const parsed = submitReportFieldsSchema.safeParse({
      issueType: data.get("issueType") || undefined,
      manualOverride: data.get("manualOverride") || undefined,
      description: data.get("description"),
      lat: data.get("lat"),
      lng: data.get("lng"),
      locationLabel: data.get("locationLabel"),
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid report data");
    }

    const { description, lat, lng, locationLabel, manualOverride } = parsed.data;
    const imageBase64 = await fileToBase64(image);
    const classification = await classifyIssueFromImage({
      imageBase64,
      mimeType: image.type || "image/jpeg",
      fileName: image.name,
      description,
    });

    const issueType =
      manualOverride && parsed.data.issueType ? parsed.data.issueType : classification.issueType;

    const started = Date.now();
    const imagePath = await saveImageFromFile(image);
    const analysis = await analyzeReport({
      issueType,
      description,
      imageSizeBytes: image.size,
      imageMimeType: image.type || "image/jpeg",
      visionConfidence: classification.confidence,
      classificationReason: classification.reason,
      usedCloudVision: classification.usedCloudVision,
    });

    const status: ReportStatus = analysis.routed ? "routed" : "manual_review";
    const id = generateTicketId();

    const report = insertReport({
      id,
      issueType,
      description,
      imagePath,
      lat,
      lng,
      locationLabel,
      visionScore: analysis.vision,
      nlpScore: analysis.nlp,
      finalScore: analysis.final,
      routed: analysis.routed,
      department: analysis.department as Department,
      status,
      statusNote: analysis.routed
        ? `Auto-routed to ${analysis.department} (${Math.round(analysis.final * 100)}% confidence)`
        : `Queued for manual review (${Math.round(analysis.final * 100)}% confidence)`,
    });

    console.info(`Report ${id} analyzed in ${Date.now() - started}ms`, analysis.details);
    return toAnalysisResult(report);
  });

export const fetchReport = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    bootstrapDb();
    const report = getReportById(data.id);
    if (!report) throw new Error("Report not found");
    const history = getStatusHistory(data.id);
    return { report, history };
  });

export const fetchReports = createServerFn({ method: "GET" })
  .validator((data: { status?: ReportStatus; department?: Department; limit?: number }) =>
    z
      .object({
        status: statusSchema.optional(),
        department: z.enum(DEPARTMENTS).optional(),
        limit: z.number().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    bootstrapDb();
    return listReports(data);
  });

export const changeReportStatus = createServerFn({ method: "POST" })
  .validator((data: { id: string; status: ReportStatus; note?: string }) =>
    z
      .object({
        id: z.string(),
        status: statusSchema,
        note: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    bootstrapDb();
    const updated = updateReportStatus(data.id, data.status, data.note);
    if (!updated) throw new Error("Report not found");
    return updated;
  });

export const getDashboardSummary = createServerFn({ method: "GET" }).handler(async () => {
  bootstrapDb();
  const stats = getPlatformStats();
  const all = listReports({ limit: 200 });
  const byStatus = statusSchema.options.reduce(
    (acc, status) => {
      acc[status] = all.filter((r) => r.status === status).length;
      return acc;
    },
    {} as Record<ReportStatus, number>,
  );

  const byDepartment = DEPARTMENTS.reduce(
    (acc, dept) => {
      acc[dept] = all.filter((r) => r.department === dept).length;
      return acc;
    },
    {} as Record<Department, number>,
  );

  return { stats, byStatus, byDepartment, recent: all.slice(0, 10) };
});

export { ISSUE_META };
