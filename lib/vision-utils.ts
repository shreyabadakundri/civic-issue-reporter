import type { IssueType } from "./constants";
import type { ImageClassificationResult } from "./types";

export const LOCAL_MODEL_PATH = "/models/civic-classifier/model.json";
export const LOCAL_MODEL_METADATA_PATH = "/models/civic-classifier/metadata.json";

export type LocalModelMetadata = {
  labels: IssueType[];
  imageSize: number;
};

export function parseLocalModelMetadata(raw: unknown): LocalModelMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.labels)) return null;
  const labels = data.labels.filter((label): label is IssueType =>
    label === "pothole" || label === "garbage" || label === "manhole",
  );
  if (labels.length !== 3) return null;
  return {
    labels,
    imageSize: typeof data.imageSize === "number" ? data.imageSize : 224,
  };
}

export function buildClassificationFromScores(
  labels: IssueType[],
  scores: number[],
  reasonPrefix: string,
  modelSource: "local" | "heuristic" = "local",
): ImageClassificationResult {
  const indexed = labels.map((issueType, index) => ({
    issueType,
    confidence: scores[index] ?? 0,
  }));
  indexed.sort((a, b) => b.confidence - a.confidence);
  const top = indexed[0];
  const alternatives = indexed.slice(1, 3);

  return {
    issueType: top.issueType,
    confidence: Math.max(0.15, Math.min(0.99, top.confidence)),
    reason: `${reasonPrefix}: ${top.issueType} (${Math.round(top.confidence * 100)}%)`,
    usedOpenAi: false,
    modelSource,
    alternatives,
  };
}

export function mobilenetPreprocess(tensor: import("@tensorflow/tfjs").Tensor3D) {
  return tensor.toFloat().div(127.5).sub(1);
}
