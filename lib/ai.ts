import {
  ISSUE_META,
  NLP_WEIGHT,
  ROUTING_THRESHOLD,
  VISION_WEIGHT,
  type IssueType,
} from "./constants";
import type { ImageClassificationResult } from "./types";

export type { ImageClassificationResult };

export type AnalysisInput = {
  issueType: IssueType;
  description: string;
  imageSizeBytes: number;
  imageMimeType: string;
  visionConfidence?: number;
  classificationReason?: string;
  usedOpenAiVision?: boolean;
};

export type ClassificationInput = {
  imageBase64: string;
  mimeType: string;
  fileName?: string;
  description?: string;
};

export type AnalysisOutput = {
  vision: number;
  nlp: number;
  final: number;
  routed: boolean;
  department: string;
  detectedIssueType: IssueType;
  details: {
    visionSignals: string[];
    nlpSignals: string[];
    usedOpenAi: boolean;
    classificationReason?: string;
  };
};

const ISSUE_TYPES: IssueType[] = ["pothole", "garbage", "manhole"];

function clamp(value: number, min = 0.15, max = 0.99) {
  return Math.max(min, Math.min(max, value));
}

function keywordScore(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  const hits = keywords.filter((word) => lower.includes(word));
  return hits.length / keywords.length;
}

function normalizeIssueType(value: unknown): IssueType | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().trim();
  if (normalized.includes("manhole") || normalized.includes("sewer") || normalized.includes("drain")) {
    return "manhole";
  }
  if (normalized.includes("garbage") || normalized.includes("trash") || normalized.includes("waste")) {
    return "garbage";
  }
  if (normalized.includes("pothole") || normalized.includes("asphalt") || normalized.includes("crater")) {
    return "pothole";
  }
  return ISSUE_TYPES.includes(normalized as IssueType) ? (normalized as IssueType) : null;
}

async function classifyWithOpenAi(input: ClassificationInput): Promise<ImageClassificationResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Classify civic issue photos. Return JSON: {"issueType":"pothole"|"garbage"|"manhole","confidence":0-1,"reason":"string","alternatives":[{"issueType":"...","confidence":0-1}]}',
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Classify this photo: pothole = road hole/crack/asphalt damage; garbage = trash/waste/litter pile; manhole = sewer cover/drain/missing cover.",
              },
              {
                type: "image_url",
                image_url: { url: `data:${input.mimeType};base64,${input.imageBase64}` },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as {
      issueType?: string;
      confidence?: number;
      reason?: string;
      alternatives?: Array<{ issueType?: string; confidence?: number }>;
    };

    const issueType = normalizeIssueType(parsed.issueType);
    if (!issueType) return null;

    const alternatives = (parsed.alternatives ?? [])
      .map((item) => {
        const type = normalizeIssueType(item.issueType);
        if (!type) return null;
        return { issueType: type, confidence: clamp(Number(item.confidence) || 0.2, 0.1, 0.95) };
      })
      .filter((item): item is { issueType: IssueType; confidence: number } => item !== null)
      .slice(0, 2);

    return {
      issueType,
      confidence: clamp(Number(parsed.confidence) || 0.75),
      reason: parsed.reason ?? "OpenAI vision classification",
      usedOpenAi: true,
      modelSource: "openai",
      alternatives,
    };
  } catch {
    return null;
  }
}

function classifyHeuristic(input: ClassificationInput): ImageClassificationResult {
  const text = `${input.fileName ?? ""} ${input.description ?? ""}`.toLowerCase();

  const scores = ISSUE_TYPES.map((issueType) => ({
    issueType,
    score: keywordScore(text, ISSUE_META[issueType].keywords),
  })).sort((a, b) => b.score - a.score);

  const top = scores[0];
  const second = scores[1];
  const hasSignal = top.score > 0;
  const issueType = top.issueType;
  const confidence = hasSignal
    ? clamp(0.52 + top.score * 0.35 - (second?.score ?? 0) * 0.1)
    : 0.35;

  return {
    issueType,
    confidence,
    reason: hasSignal
      ? `Matched ${ISSUE_META[issueType].label} from filename/description keywords`
      : "No photo model found — run python ml/train.py or set OPENAI_API_KEY",
    usedOpenAi: false,
    modelSource: "heuristic",
    alternatives: scores.slice(1, 3).map((item) => ({
      issueType: item.issueType,
      confidence: clamp(item.score * 0.5 + 0.15),
    })),
  };
}

export async function classifyIssueFromImage(
  input: ClassificationInput,
): Promise<ImageClassificationResult> {
  const openAiResult = await classifyWithOpenAi(input);
  if (openAiResult) return openAiResult;

  try {
    const { classifyWithLocalModel } = await import("./local-vision");
    const localResult = await classifyWithLocalModel({
      imageBuffer: Buffer.from(input.imageBase64, "base64"),
      mimeType: input.mimeType,
    });
    if (localResult) {
      return { ...localResult, modelSource: "local" };
    }
  } catch (error) {
    console.warn("Local model unavailable:", error);
  }

  return classifyHeuristic(input);
}

function buildNlpScore(issueType: IssueType, description: string) {
  const desc = description.trim();
  const words = desc.split(/\s+/).filter(Boolean);
  const keywordMatch = keywordScore(desc, ISSUE_META[issueType].keywords);
  const lengthBoost = Math.min(0.12, words.length / 80);
  const severityBoost = /severe|danger|hazard|traffic|blocked|deep|large|urgent/i.test(desc)
    ? 0.08
    : 0;

  return clamp(
    ISSUE_META[issueType].baseNlp + keywordMatch * 0.2 + lengthBoost + severityBoost - 0.02,
  );
}

export async function analyzeReport(input: AnalysisInput): Promise<AnalysisOutput> {
  const meta = ISSUE_META[input.issueType];
  const vision = clamp(input.visionConfidence ?? meta.baseVision);
  const nlp = buildNlpScore(input.issueType, input.description);
  const final = vision * VISION_WEIGHT + nlp * NLP_WEIGHT;

  const visionSignals = input.classificationReason
    ? [input.classificationReason, `Vision confidence ${Math.round(vision * 100)}%`]
    : [
        input.imageMimeType.startsWith("image/") ? "Valid image uploaded" : "Image format uncertain",
        input.imageSizeBytes > 10_000 ? "Sufficient image payload" : "Low-resolution image",
        `Classified as ${meta.label}`,
      ];

  const keywordMatch = keywordScore(input.description, meta.keywords);
  const nlpSignals = [
    `${Math.round(keywordMatch * 100)}% keyword alignment with ${meta.label}`,
    input.description.trim().split(/\s+/).length >= 8
      ? "Detailed citizen description"
      : "Short description",
  ];

  return {
    vision,
    nlp,
    final,
    routed: final >= ROUTING_THRESHOLD,
    department: meta.department,
    detectedIssueType: input.issueType,
    details: {
      visionSignals,
      nlpSignals,
      usedOpenAi: Boolean(input.usedOpenAiVision),
      classificationReason: input.classificationReason,
    },
  };
}
