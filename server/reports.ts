import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { buildAdminAnalytics } from "@/lib/admin-analytics";
import {
  assertRole,
  authenticateUser,
  createSessionToken,
  parseSessionToken,
} from "@/lib/auth";

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
  routeManualReviewReport,
  seedDemoReports,
  updateReportStatus,
} from "@/lib/db";
import { listEmailOutbox, notifyDepartmentsForReport } from "@/lib/email";
import {
  buildIssueBreakdown,
  fuseModalityScores,
  normalizeActiveBreakdownPercentages,
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

export const authLogin = createServerFn({ method: "POST" })
  .validator((data: { username: string; password: string }) =>
    z.object({ username: z.string().min(1), password: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const role = authenticateUser(data.username, data.password);
    if (!role) throw new Error("Invalid username or password");
    const username = data.username.trim();
    return {
      token: createSessionToken(role, username),
      role,
      username,
    };
  });

export const verifyAuthSession = createServerFn({ method: "GET" })
  .validator((data: { token: string }) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const session = parseSessionToken(data.token);
    if (!session) return { ok: false as const };
    return { ok: true as const, role: session.role, username: session.username };
  });

export const getEmailOutbox = createServerFn({ method: "GET" })
  .validator((data: { authToken: string }) => z.object({ authToken: z.string() }).parse(data))
  .handler(async ({ data }) => {
    assertRole(data.authToken, "admin");
    await bootstrapDb();
    return listEmailOutbox(50);
  });

export const getAdminAnalytics = createServerFn({ method: "GET" })
  .validator((data: { authToken: string }) => z.object({ authToken: z.string() }).parse(data))
  .handler(async ({ data }) => {
    assertRole(data.authToken, "admin");
    await bootstrapDb();
    const stats = await getPlatformStats();
    const all = await listReports({ limit: 500 });
    return buildAdminAnalytics(all, stats);
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
    const hasDescription = description.trim().length >= 10;

    let classification: ImageClassificationResult;
    if (image) {
      const imageBase64 = await fileToBase64(image);
      classification = await classifyIssueFromImage({
        imageBase64,
        mimeType: image.type || "image/jpeg",
        fileName: image.name,
        description: hasDescription ? description.trim() : undefined,
      });
    } else {
      classification = classifyIssueFromDescription(description);
    }

    const visionScores = image ? scoresFromClassification(classification) : null;
    const nlpScores = hasDescription ? scoresFromDescription(description.trim()) : null;
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
    const activeBreakdown = normalizeActiveBreakdownPercentages(summary.activeBreakdown);
    const issueType = manualOverride && parsed.data.issueType ? parsed.data.issueType : summary.primaryIssueType;

    const started = Date.now();
    const imagePath = image
      ? await saveImageFromFile(image)
      : "/uploads/demo-placeholder.jpg";

    const visionForAnalysis = summary.isMultiIssue
      ? Math.max(...activeBreakdown.map((b) => b.confidence), 0)
      : (breakdown.find((b) => b.issueType === issueType)?.confidence ?? classification.confidence);

    const analysis = await analyzeReport({
      issueType,
      description: hasDescription ? description.trim() : "",
      imageSizeBytes: image?.size ?? 0,
      imageMimeType: image?.type || "text/plain",
      visionConfidence: visionForAnalysis,
      classificationReason: classification.reason,
      usedCloudVision: classification.usedCloudVision,
      photoOnly: Boolean(image) && !hasDescription,
    });

    const status: ReportStatus = summary.routed ? "routed" : "manual_review";
    const id = await generateTicketId();

    const departmentsToNotify = summary.routed
      ? summary.isMultiIssue
        ? summary.departments
        : [ISSUE_META[issueType].department as Department]
      : [];

    const mixLabel = activeBreakdown
      .map((b) => `${ISSUE_META[b.issueType].label} ${b.percentage}%`)
      .join(", ");

    const statusNote = summary.isMultiIssue
      ? summary.routed
        ? `Multi-issue alert: ${mixLabel} → ${summary.departments.join(", ")}`
        : `Manual review: ${mixLabel} — one or more issues below auto-route threshold`
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
      finalScore: summary.isMultiIssue
        ? Math.max(...activeBreakdown.map((b) => b.confidence), analysis.final)
        : analysis.final,
      routed: summary.routed,
      department: ISSUE_META[issueType].department as Department,
      status,
      statusNote,
      isMultiIssue: summary.isMultiIssue,
      issueBreakdown: activeBreakdown,
      notifiedDepartments: departmentsToNotify,
    });

    const emails =
      departmentsToNotify.length > 0
        ? await notifyDepartmentsForReport({
            reportId: id,
            locationLabel,
            description: description || "(Photo-only submission)",
            breakdown: activeBreakdown,
            departments: departmentsToNotify,
          })
        : [];

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
  .validator(
    (data: {
      status?: ReportStatus;
      department?: Department;
      limit?: number;
      authToken?: string;
    }) =>
      z
        .object({
          status: statusSchema.optional(),
          department: z.enum(DEPARTMENTS).optional(),
          limit: z.number().optional(),
          authToken: z.string().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    await bootstrapDb();
    const isDeptScoped = Boolean(data.department);
    const isAdminList = !isDeptScoped && (data.limit ?? 0) > 50;
    if (isAdminList || (data.status && !data.department)) {
      assertRole(data.authToken, "admin");
    }
    return listReports(data);
  });

export const changeReportStatus = createServerFn({ method: "POST" })
  .validator(
    (data: { id: string; status: ReportStatus; note?: string; authToken?: string }) =>
      z
        .object({
          id: z.string(),
          status: statusSchema,
          note: z.string().optional(),
          authToken: z.string().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    if (data.note?.includes("by admin")) {
      assertRole(data.authToken, "admin");
    }
    await bootstrapDb();
    const updated = await updateReportStatus(data.id, data.status, data.note);
    if (!updated) throw new Error("Report not found");
    return updated;
  });

export const adminRouteManualReview = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      department: Department;
      issueType?: IssueType;
      note?: string;
      authToken: string;
    }) =>
      z
        .object({
          id: z.string(),
          department: z.enum(DEPARTMENTS),
          issueType: issueTypeSchema.optional(),
          note: z.string().max(500).optional(),
          authToken: z.string(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    assertRole(data.authToken, "admin");
    await bootstrapDb();
    const updated = await routeManualReviewReport(data.id, {
      department: data.department,
      issueType: data.issueType,
      note: data.note,
    });
    if (!updated) {
      throw new Error("Ticket not found or not in manual review");
    }

    const breakdown =
      updated.issueBreakdown?.length
        ? updated.issueBreakdown
        : [
            {
              issueType: updated.issueType,
              percentage: 100,
              confidence: updated.finalScore,
              department: updated.department,
              routed: true,
            },
          ];

    await notifyDepartmentsForReport({
      reportId: updated.id,
      locationLabel: updated.locationLabel,
      description: updated.description,
      breakdown,
      departments: [updated.department],
    });

    return updated;
  });

export { ISSUE_META };
