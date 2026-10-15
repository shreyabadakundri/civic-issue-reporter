import { z } from "zod";

import type { ImageClassificationResult } from "./types";

const issueTypeSchema = z.enum(["pothole", "garbage", "manhole"]);

export const imageClassificationResultSchema = z.object({
  issueType: issueTypeSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  usedCloudVision: z.boolean(),
  modelSource: z.enum(["cohere", "openai", "local", "heuristic"]),
  alternatives: z.array(
    z.object({
      issueType: issueTypeSchema,
      confidence: z.number().min(0).max(1),
    }),
  ),
  perClassScores: z
    .object({
      pothole: z.number().min(0).max(1),
      garbage: z.number().min(0).max(1),
      manhole: z.number().min(0).max(1),
    })
    .optional(),
});

export function parseCachedClassification(raw: unknown): ImageClassificationResult | null {
  const parsed = imageClassificationResultSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data;
}

export function parseClassificationJsonField(value: FormDataEntryValue | null): ImageClassificationResult | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return parseCachedClassification(JSON.parse(value));
  } catch {
    return null;
  }
}
