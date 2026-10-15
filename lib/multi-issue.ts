import {
  ISSUE_CANDIDATE_MIN_CONFIDENCE,
  ISSUE_META,
  MULTI_ISSUE_MIN_CONFIDENCE,
  NLP_WEIGHT,
  ROUTING_THRESHOLD,
  VISION_WEIGHT,
  type IssueType,
} from "./constants";
import type { Department } from "./constants";
import type { ImageClassificationResult, IssueBreakdownItem } from "./types";

export { ISSUE_CANDIDATE_MIN_CONFIDENCE, MULTI_ISSUE_MIN_CONFIDENCE };

const ISSUE_TYPES: IssueType[] = ["pothole", "garbage", "manhole"];

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function keywordScore(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  const hits = keywords.filter((word) => lower.includes(word));
  return hits.length / keywords.length;
}

export function scoresFromDescription(description: string): Record<IssueType, number> {
  const trimmed = description.trim();
  if (!trimmed) {
    return { pothole: 0, garbage: 0, manhole: 0 };
  }

  const raw = ISSUE_TYPES.map((issueType) => ({
    issueType,
    score: keywordScore(trimmed, ISSUE_META[issueType].keywords),
  }));

  const max = Math.max(...raw.map((item) => item.score), 0.01);
  const boosted = raw.map((item) => ({
    issueType: item.issueType,
    score: item.score > 0 ? item.score + max * 0.15 : item.score * 0.5,
  }));

  const sum = boosted.reduce((acc, item) => acc + item.score, 0) || 1;
  return Object.fromEntries(
    boosted.map((item) => [item.issueType, item.score / sum]),
  ) as Record<IssueType, number>;
}

export function scoresFromClassification(
  classification: ImageClassificationResult,
): Record<IssueType, number> {
  const scores: Record<IssueType, number> = {
    pothole: 0,
    garbage: 0,
    manhole: 0,
  };

  if (classification.perClassScores) {
    for (const issueType of ISSUE_TYPES) {
      scores[issueType] = clamp(classification.perClassScores[issueType] ?? 0, 0.01, 0.99);
    }
  } else {
    scores[classification.issueType] = classification.confidence;
    for (const alt of classification.alternatives) {
      scores[alt.issueType] = Math.max(scores[alt.issueType], alt.confidence);
    }
    const remainder = Math.max(0, 1 - classification.confidence);
    const others = ISSUE_TYPES.filter((t) => t !== classification.issueType);
    const altSum = others.reduce((acc, t) => acc + scores[t], 0) || 1;
    for (const t of others) {
      scores[t] += (remainder * scores[t]) / altSum;
    }
  }

  const sum = ISSUE_TYPES.reduce((acc, t) => acc + scores[t], 0) || 1;
  return Object.fromEntries(ISSUE_TYPES.map((t) => [t, scores[t] / sum])) as Record<
    IssueType,
    number
  >;
}

export function fuseModalityScores(input: {
  vision?: Record<IssueType, number> | null;
  nlp?: Record<IssueType, number> | null;
}): Record<IssueType, number> {
  const hasVision = input.vision && ISSUE_TYPES.some((t) => (input.vision![t] ?? 0) > 0);
  const hasNlp = input.nlp && ISSUE_TYPES.some((t) => (input.nlp![t] ?? 0) > 0);

  const fused = {} as Record<IssueType, number>;
  for (const issueType of ISSUE_TYPES) {
    const v = hasVision ? (input.vision![issueType] ?? 0) : 0;
    const n = hasNlp ? (input.nlp![issueType] ?? 0) : 0;

    if (hasVision && hasNlp) {
      fused[issueType] = v * VISION_WEIGHT + n * NLP_WEIGHT;
    } else if (hasVision) {
      fused[issueType] = v;
    } else if (hasNlp) {
      fused[issueType] = n;
    } else {
      fused[issueType] = 1 / ISSUE_TYPES.length;
    }
  }

  const sum = ISSUE_TYPES.reduce((acc, t) => acc + fused[t], 0) || 1;
  return Object.fromEntries(ISSUE_TYPES.map((t) => [t, fused[t] / sum])) as Record<
    IssueType,
    number
  >;
}

export function buildIssueBreakdown(fused: Record<IssueType, number>): IssueBreakdownItem[] {
  const items = ISSUE_TYPES.map((issueType) => {
    const confidence = clamp(fused[issueType]);
    const percentage = Math.round(confidence * 1000) / 10;
    const department = ISSUE_META[issueType].department as Department;
    return {
      issueType,
      percentage,
      confidence,
      department,
      routed: confidence >= ROUTING_THRESHOLD,
    };
  }).sort((a, b) => b.confidence - a.confidence);

  const candidates = items.filter((item) => item.confidence >= ISSUE_CANDIDATE_MIN_CONFIDENCE);
  if (candidates.length >= 2) {
    return items;
  }

  const activeTypes = items.filter((item) => item.confidence >= MULTI_ISSUE_MIN_CONFIDENCE);
  if (activeTypes.length >= 2) {
    return items;
  }

  const top = items[0]?.confidence ?? 0;
  return items.filter(
    (item) => item.confidence >= MULTI_ISSUE_MIN_CONFIDENCE || item.confidence === top,
  );
}

export function summarizeMultiIssue(breakdown: IssueBreakdownItem[]) {
  const sorted = [...breakdown].sort((a, b) => b.confidence - a.confidence);
  const primary = sorted[0];
  const candidates = sorted.filter((item) => item.confidence >= ISSUE_CANDIDATE_MIN_CONFIDENCE);
  const isMultiIssue = candidates.length >= 2;

  const allCandidatesAutoRoutable =
    isMultiIssue &&
    candidates.every((item) => item.confidence >= MULTI_ISSUE_MIN_CONFIDENCE);

  const routed = isMultiIssue
    ? allCandidatesAutoRoutable
    : (primary?.confidence ?? 0) >= ROUTING_THRESHOLD;

  const departments =
    isMultiIssue && routed
      ? [...new Set(candidates.map((item) => item.department))]
      : !isMultiIssue && routed && primary
        ? [primary.department as Department]
        : [];

  const activeBreakdown = (isMultiIssue ? candidates : primary ? [primary] : []).map((item) => ({
    ...item,
    routed: routed && item.confidence >= MULTI_ISSUE_MIN_CONFIDENCE,
  }));

  return {
    primaryIssueType: primary?.issueType ?? ("pothole" as IssueType),
    isMultiIssue,
    departments,
    routed,
    activeBreakdown,
    belowThresholdForAutoRoute: isMultiIssue && !allCandidatesAutoRoutable,
  };
}

/** Re-normalize active issue shares to 100% for reports and emails. */
export function normalizeActiveBreakdownPercentages(
  breakdown: IssueBreakdownItem[],
): IssueBreakdownItem[] {
  const sum = breakdown.reduce((acc, item) => acc + item.confidence, 0) || 1;
  return breakdown.map((item) => {
    const share = item.confidence / sum;
    return {
      ...item,
      confidence: share,
      percentage: Math.round(share * 1000) / 10,
    };
  });
}
