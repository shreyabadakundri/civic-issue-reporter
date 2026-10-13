import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  analyzeReport,
  classifyIssueFromDescription,
  classifyIssueFromImage,
} from "@/lib/ai";
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
import { listEmailOutbox, notifyDepartmentsForReport } from "@/lib/email";
import {
  buildIssueBreakdown,
  fuseModalityScores,
  scoresFromClassification,
  scoresFromDescription,
  summarizeMultiIssue,
} from "@/lib/multi-issue";
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

const submitReportFieldsSchema = z
  .object({
    issueType: issueTypeSchema.optional(),
    manualOverride: z
      .union([z.literal("true"), z.literal("false"), z.boolean()])
      .optional()
      .transform((value) => value === true || value === "true"),
    description: z.string().trim(),
    lat: z.coerce.number(),
    lng: z.coerce.number(),
    locationLabel: z.string().trim().min(3, "Location label is required"),
    hasImage: z
      .union([z.literal("true"), z.literal("false"), z.boolean()])
      .optional()
      .transform((value) => value === true || value === "true"),
  })
  .superRefine((data, ctx) => {
    const hasImage = data.hasImage;
    const hasDescription = data.description.length >= 10;
    if (!hasImage && !hasDescription) {
      ctx.addIssue({
        code: "custom",
        message: "Provide a photo or a description (at least 10 characters).",
        path: ["description"],
      });
    }
  });

async function fileToBase64(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString("base64");
}

function parseOptionalImage(data: FormData) {
  const image = data.get("image");
  if (!(image instanceof File) || image.size === 0) return null;
  return image;
}

async function bootstrapDb() {
  ensureDemoPlaceholder();
  await seedDemoReports();
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
    isMultiIssue: report.isMultiIssue,
    issueBreakdown: report.issueBreakdown,
    notifiedDepartments: report.notifiedDepartments,
  };
}

export const getStats = createServerFn({ method: "GET" }).handler(async (): Promise<PlatformStats> => {
  await bootstrapDb();
  return getPlatformStats();
});

export const getQueues = createServerFn({ method: "GET" }).handler(async () => {
  await bootstrapDb();
  const counts = await getDepartmentQueueCounts();
  const manualReview = await getManualReviewReports(10);

  const departments: DepartmentQueue[] = DEPARTMENTS.map((department) => ({
    department,
    activeQueue: counts.get(department) ?? 0,
    incoming: false,
  }));

  return { departments, manualReview: manualReview.map(toAnalysisResult) };
});

export const getEmailOutbox = createServerFn({ method: "GET" }).handler(async () => {
  await bootstrapDb();
  return listEmailOutbox(50);
});

export const classifyReportImage = createServerFn({ method: "POST" })
  .validator((formData: FormData) => formData)
  .handler(async ({ data }): Promise<ImageClassificationResult> => {
    const image = parseOptionalImage(data);
    if (!image) throw new Error("Image is required for photo classification");
    const description = data.get("description");
    const imageBase64 = await fileToBase64(image);

    return classifyIssueFromImage({
      imageBase64,
      mimeType: image.type || "image/jpeg",
      fileName: image.name,
      description: typeof description === "string" ? description : undefined,
    });
  });

export const classifyReportDescription = createServerFn({ method: "POST" })
  .validator((data: { description: string }) =>
    z.object({ description: z.string().trim().min(10) }).parse(data),
  )
  .handler(async ({ data }): Promise<ImageClassificationResult> => {
    return classifyIssueFromDescription(data.description);
  });

export const submitReport = createServerFn({ method: "POST" })
  .validator((formData: FormData) => formData)
  .handler(async ({ data }): Promise<AnalysisResult> => {
    await bootstrapDb();

    const image = parseOptionalImage(data);
    const parsed = submitReportFieldsSchema.safeParse({
      issueType: data.get("issueType") || undefined,
      manualOverride: data.get("manualOverride") || undefined,
      description: data.get("description") ?? "",
      lat: data.get("lat"),
      lng: data.get("lng"),
      locationLabel: data.get("locationLabel"),
      hasImage: Boolean(image),
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid report data");
    }

    const { description, lat, lng, locationLabel, manualOverride } = parsed.data;

    let classification: ImageClassificationResult;
    if (image) {
      const imageBase64 = await fileToBase64(image);
      classification = await classifyIssueFromImage({
        imageBase64,
        mimeType: image.type || "image/jpeg",
        fileName: image.name,
        description: description || undefined,
      });
    } else {
      classification = classifyIssueFromDescription(description);
    }

    const visionScores = image ? scoresFromClassification(classification) : null;
    const nlpScores = description.trim() ? scoresFromDescription(description) : null;
    const fused = fuseModalityScores({ vision: visionScores, nlp: nlpScores });
    let breakdown = buildIssueBreakdown(fused);

    if (manualOverride && parsed.data.issueType) {
      const chosen = parsed.data.issueType;
      breakdown = breakdown.map((item) =>
        item.issueType === chosen
          ? { ...item, confidence: Math.max(item.confidence, 0.72), percentage: Math.max(item.percentage, 72) }
          : item,
      );
      breakdown.sort((a, b) => b.confidence - a.confidence);
    }

    const summary = summarizeMultiIssue(breakdown);
    const issueType = manualOverride && parsed.data.issueType ? parsed.data.issueType : summary.primaryIssueType;

    const started = Date.now();
    const imagePath = image
      ? await saveImageFromFile(image)
      : "/uploads/demo-placeholder.jpg";

    const analysis = await analyzeReport({
      issueType,
      description: description || "(Photo-only report — no written description)",
      imageSizeBytes: image?.size ?? 0,
      imageMimeType: image?.type || "text/plain",
      visionConfidence: breakdown.find((b) => b.issueType === issueType)?.confidence ?? classification.confidence,
      classificationReason: classification.reason,
      usedCloudVision: classification.usedCloudVision,
    });

    const status: ReportStatus = summary.routed ? "routed" : "manual_review";
    const id = await generateTicketId();

    const departmentsToNotify = summary.isMultiIssue
      ? summary.departments
      : [ISSUE_META[issueType].department as Department];

    const statusNote = summary.isMultiIssue
      ? `Multi-issue alert: ${summary.activeBreakdown.map((b) => `${ISSUE_META[b.issueType].label} ${b.percentage}%`).join(", ")}`
      : summary.routed
        ? `Auto-routed to ${ISSUE_META[issueType].department} (${Math.round(analysis.final * 100)}% confidence)`
        : `Queued for manual review (${Math.round(analysis.final * 100)}% confidence)`;

    const report = await insertReport({
      id,
      issueType,
      description: description || "(Photo-only submission)",
      imagePath,
      lat,
      lng,
      locationLabel,
      visionScore: analysis.vision,
      nlpScore: analysis.nlp,
      finalScore: analysis.final,
      routed: summary.routed,
      department: ISSUE_META[issueType].department as Department,
      status,
      statusNote,
      isMultiIssue: summary.isMultiIssue,
      issueBreakdown: summary.activeBreakdown,
      notifiedDepartments: departmentsToNotify,
    });

    const emails = await notifyDepartmentsForReport({
      reportId: id,
      locationLabel,
      description: description || "(Photo-only submission)",
      breakdown: summary.activeBreakdown,
      departments: departmentsToNotify,
    });

    console.info(`Report ${id} analyzed in ${Date.now() - started}ms`, {
      multi: summary.isMultiIssue,
      departments: departmentsToNotify,
      emails: emails.length,
    });

    return {
      ...toAnalysisResult(report),
      emailsSent: emails.length,
    };
  });

export const fetchReport = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    await bootstrapDb();
    const report = await getReportById(data.id);
    if (!report) throw new Error("Report not found");
    const history = await getStatusHistory(data.id);
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
    await bootstrapDb();
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
    await bootstrapDb();
    const updated = await updateReportStatus(data.id, data.status, data.note);
    if (!updated) throw new Error("Report not found");
    return updated;
  });

export const getDashboardSummary = createServerFn({ method: "GET" }).handler(async () => {
  await bootstrapDb();
  const stats = await getPlatformStats();
  const all = await listReports({ limit: 200 });
  const byStatus = statusSchema.options.reduce(
    (acc, status) => {
      acc[status] = all.filter((r) => r.status === status).length;
      return acc;
    },
    {} as Record<ReportStatus, number>,
  );

  const byDepartment = DEPARTMENTS.reduce(
    (acc, dept) => {
      acc[dept] = all.filter(
        (r) => r.department === dept || r.notifiedDepartments?.includes(dept),
      ).length;
      return acc;
    },
    {} as Record<Department, number>,
  );

  return { stats, byStatus, byDepartment, recent: all.slice(0, 10) };
});

export { ISSUE_META };
