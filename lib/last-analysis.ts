import type { AnalysisResult } from "@/lib/types";

const STORAGE_KEY = "civicmind:lastAnalysis";

export function saveLastAnalysis(result: AnalysisResult) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
}

export function loadLastAnalysis(): AnalysisResult | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AnalysisResult;
  } catch {
    return null;
  }
}
