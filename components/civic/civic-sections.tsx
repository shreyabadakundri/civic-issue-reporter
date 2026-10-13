import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Brain, CheckCircle2,
  Cpu, Eye, Gauge, Github, Globe2, Languages, MapPin, Radio, Shield,
  ShieldCheck, Sparkles, Trash2, Upload, Workflow, Wrench, Droplets,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

import { useLocalClassifier } from "@/hooks/use-local-classifier";
import { ISSUE_META, type IssueType } from "@/lib/constants";
import {
  ISSUE_CANDIDATE_MIN_CONFIDENCE,
  MULTI_ISSUE_MIN_CONFIDENCE,
} from "@/lib/multi-issue";
import type { AnalysisResult, ImageClassificationResult } from "@/lib/types";
import { saveLastAnalysis } from "@/lib/last-analysis";
import {
  classifyReportDescription,
  classifyReportImage,
  getStats,
  submitReport,
} from "@/server/reports";

const ISSUE_UI = {
  pothole: { deptIcon: Wrench },
  garbage: { deptIcon: Trash2 },
  manhole: { deptIcon: Droplets },
} as const;

const ISSUE_TYPES: IssueType[] = ["pothole", "garbage", "manhole"];

const MULTI_DISPLAY_MIN_SCORE = ISSUE_CANDIDATE_MIN_CONFIDENCE;

function getClassificationMix(classification: ImageClassificationResult) {
  return ISSUE_TYPES.map((type) => {
    const score =
      classification.perClassScores?.[type] ??
      (type === classification.issueType
        ? classification.confidence
        : classification.alternatives.find((a) => a.issueType === type)?.confidence ?? 0);
    return { type, score, pct: Math.round(score * 100) };
  }).sort((a, b) => b.score - a.score);
}

function getVisibleIssues(classification: ImageClassificationResult) {
  return getClassificationMix(classification).filter((item) => item.score >= MULTI_DISPLAY_MIN_SCORE);
}

function isMultiIssueClassification(classification: ImageClassificationResult) {
  return getVisibleIssues(classification).length >= 2;
}

function hasBelowAutoRouteThreshold(classification: ImageClassificationResult) {
  const visible = getVisibleIssues(classification);
  return visible.length >= 2 && visible.some((item) => item.score < MULTI_ISSUE_MIN_CONFIDENCE);
}

export function HeroSection({ stats }: { stats: Awaited<ReturnType<typeof getStats>> }) {
  return (
    <section id="home" className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 pt-20 pb-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="fade-up">
            <Badge variant="outline" className="mb-5 border-primary/40 text-primary bg-primary/5">
              <Sparkles className="h-3 w-3 mr-1" /> AI · Vision + NLP · Real-Time Routing
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
              AI-Enabled Smart Governance for{" "}
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Real-Time Civic Issue Detection
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              Citizens report. Vision &amp; NLP models analyze. A weighted confidence score
              auto-routes issues to the right department — or flags them for manual review.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/report"><Button size="lg" className="glow">Report a Civic Issue<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              <Link to="/about"><Button size="lg" variant="outline">How it works</Button></Link>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
              {[
                { v: stats.totalReports.toLocaleString(), l: "Reports Processed" },
                { v: stats.totalReports ? `${stats.autoRouteRate}%` : "—", l: "Auto-Route Rate" },
                { v: stats.totalReports ? `${(stats.avgLatencyMs / 1000).toFixed(1)}s` : "—", l: "Avg AI Latency" },
              ].map(s => (
                <div key={s.l} className="glass rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-primary">{s.v}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative fade-up">
            <div className="glass rounded-3xl p-6 glow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-muted-foreground">Live Pipeline</span>
                </div>
                <Badge variant="secondary"><Cpu className="h-3 w-3 mr-1" />v2.1</Badge>
              </div>
              <div className="space-y-3">
                {[
                  { i: Eye, n: "Vision Model", v: 89, c: "text-primary" },
                  { i: Languages, n: "NLP Model", v: 76, c: "text-accent" },
                  { i: Gauge, n: "Weighted Final Score", v: 85, c: "text-emerald-400" },
                ].map(r => (
                  <div key={r.n} className="rounded-xl bg-white/5 p-3">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="flex items-center gap-2"><r.i className={`h-4 w-4 ${r.c}`} />{r.n}</span>
                      <span className="font-mono">{r.v}%</span>
                    </div>
                    <Progress value={r.v} className="h-1.5" />
                  </div>
                ))}
                <div className="rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Routed To</div>
                    <div className="font-semibold flex items-center gap-2"><Wrench className="h-4 w-4" />Public Works</div>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />Auto Routed
                  </Badge>
                </div>
              </div>
            </div>
            <div className="absolute -z-10 -inset-6 bg-gradient-to-tr from-primary/30 to-accent/30 blur-3xl rounded-full" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function AboutSection() {
  const features = [
    { i: Eye, t: "Computer Vision", d: "Detects potholes, garbage, and manhole defects from uploaded imagery." },
    { i: Languages, t: "NLP Understanding", d: "Parses citizen descriptions to validate and enrich the report context." },
    { i: Gauge, t: "Weighted Scoring", d: "Confidence = (Vision × 0.7) + (NLP × 0.3) drives every routing decision." },
    { i: Workflow, t: "Smart Routing", d: "Auto-dispatch above threshold; queue ambiguous cases for human review." },
    { i: Shield, t: "Govt-Grade Security", d: "Encrypted submissions, audit trails, and role-based department access." },
    { i: Radio, t: "Real-Time Notifications", d: "Citizens get instant confirmation; departments get prioritized alerts." },
  ];
  return (
    <section id="about" className="py-24 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl mb-12">
          <Badge variant="outline" className="mb-3 border-accent/40 text-accent bg-accent/5">About the System</Badge>
          <h2 className="text-3xl md:text-4xl font-bold">A municipal nervous system, powered by AI.</h2>
          <p className="mt-4 text-muted-foreground">
            CivicMind unifies citizen reporting, multimodal AI analysis, and departmental
            workflows into one transparent pipeline — turning everyday observations into
            actionable, geo-tagged service tickets.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, idx) => (
            <Card key={f.t} className="glass border-white/10 p-6 hover:border-primary/40 transition-all hover:-translate-y-1" style={{ animationDelay: `${idx * 60}ms` }}>
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 grid place-items-center mb-4">
                <f.i className="h-5 w-5 text-primary" />
              </div>
              <div className="font-semibold mb-1">{f.t}</div>
              <div className="text-sm text-muted-foreground">{f.d}</div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

type LocationState = {
  lat: number | null;
  lng: number | null;
  label: string;
  loading: boolean;
  isLive: boolean;
};

export function ReportFlow({ onSubmitted }: { onSubmitted: () => void }) {
  const navigate = useNavigate();
  const [issueType, setIssueType] = useState<IssueType | "">("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [classifyingText, setClassifyingText] = useState(false);
  const [classification, setClassification] = useState<ImageClassificationResult | null>(null);
  const [manualOverride, setManualOverride] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [location, setLocation] = useState<LocationState>({
    lat: null,
    lng: null,
    label: "Detecting your location…",
    loading: true,
    isLive: false,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const localClassifier = useLocalClassifier();
  const geoWatchRef = useRef<number | null>(null);

  const applyGpsPosition = (pos: GeolocationPosition) => {
    if (geoWatchRef.current != null) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
      geoWatchRef.current = null;
    }
    setLocation({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      label: `Live GPS · ${pos.coords.latitude.toFixed(5)}°, ${pos.coords.longitude.toFixed(5)}°`,
      loading: false,
      isLive: true,
    });
  };

  const refreshLocation = () => {
    if (!navigator.geolocation) {
      setLocation({
        lat: null,
        lng: null,
        label: "Geolocation not supported in this browser",
        loading: false,
        isLive: false,
      });
      return;
    }

    setLocation((prev) => ({
      ...prev,
      loading: true,
      label: "Detecting your location…",
      isLive: false,
    }));

    if (geoWatchRef.current != null) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
      geoWatchRef.current = null;
    }

    navigator.geolocation.getCurrentPosition(
      applyGpsPosition,
      (err) => {
        const hint =
          err.code === err.PERMISSION_DENIED
            ? "Location blocked — allow location for this site in the browser address bar"
            : err.code === err.TIMEOUT
              ? "Location timed out — move near a window or try again"
              : "Could not get GPS — check device location is on";
        setLocation({
          lat: null,
          lng: null,
          label: hint,
          loading: false,
          isLive: false,
        });
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );

    geoWatchRef.current = navigator.geolocation.watchPosition(
      applyGpsPosition,
      () => {},
      { enableHighAccuracy: true, maximumAge: 5_000 },
    );
  };

  useEffect(() => {
    refreshLocation();
    return () => {
      if (geoWatchRef.current != null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
      }
    };
  }, []);

  const applyClassificationResult = (result: ImageClassificationResult, sourceLabel: string) => {
    setClassification(result);
    const visible = getVisibleIssues(result);
    if (visible.length >= 2) {
      setIssueType("");
      setManualOverride(false);
      toast.success(`${visible.length} issues detected`, {
        description: `${visible.map((v) => `${ISSUE_META[v.type].label} ${v.pct}%`).join(" · ")} · ${sourceLabel}`,
      });
    } else {
      setIssueType(result.issueType);
      toast.success(`Auto-confirmed: ${ISSUE_META[result.issueType].label}`, {
        description: `${Math.round(result.confidence * 100)}% · ${sourceLabel}`,
      });
    }
  };

  const classifyImage = async (file: File, desc?: string) => {
    setClassifying(true);
    setClassification(null);
    setIssueType("");
    setManualOverride(false);

    try {
      const formData = new FormData();
      formData.set("image", file);
      if (desc?.trim()) formData.set("description", desc.trim());

      let serverResult: ImageClassificationResult | null = null;
      try {
        serverResult = await classifyReportImage({ data: formData });
      } catch {
        serverResult = null;
      }

      const cloud =
        serverResult &&
        (serverResult.modelSource === "cohere" || serverResult.modelSource === "openai");

      if (cloud && serverResult) {
        applyClassificationResult(
          serverResult,
          serverResult.modelSource === "cohere" ? "Cohere vision" : "OpenAI vision",
        );
        return;
      }

      if (localClassifier.ready) {
        const localResult = await localClassifier.classify(file);
        if (localResult) {
          const preferLocal =
            !serverResult ||
            serverResult.modelSource === "heuristic" ||
            localResult.confidence > serverResult.confidence + 0.08;
          if (preferLocal) {
            applyClassificationResult(localResult, "Local trained model (browser)");
            return;
          }
        }
      }

      if (serverResult) {
        applyClassificationResult(serverResult, serverResult.reason);
        return;
      }

      toast.error("Could not classify image — add COHERE_API_KEY or retrain the local model");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not classify image");
    } finally {
      setClassifying(false);
    }
  };

  const classifyDescription = async (desc: string) => {
    if (desc.trim().length < 10 || imageFile) return;
    setClassifyingText(true);
    setClassification(null);
    setIssueType("");
    setManualOverride(false);
    try {
      const result = await classifyReportDescription({ data: { description: desc.trim() } });
      applyClassificationResult(result, "Text analysis");
    } catch {
      toast.error("Could not analyze description");
    } finally {
      setClassifyingText(false);
    }
  };

  useEffect(() => {
    if (imageFile) return;
    const timer = window.setTimeout(() => {
      if (description.trim().length >= 10) void classifyDescription(description);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [description, imageFile]);

  const onFile = (f?: File) => {
    if (!f) return;
    setImageFile(f);
    setImageUrl(URL.createObjectURL(f));
    void classifyImage(f, description);
  };

  const handleIssueTypeChange = (value: IssueType) => {
    setIssueType(value);
    setManualOverride(Boolean(classification && value !== classification.issueType));
  };

  const submit = async () => {
    const hasPhoto = Boolean(imageFile);
    const hasDescription = description.trim().length >= 10;
    if (!hasPhoto && !hasDescription) {
      return toast.error("Add a photo or a description (min. 10 characters)");
    }
    if (classifying || classifyingText) {
      return toast.error("Please wait for AI analysis to finish");
    }
    const multiFromAi = classification && isMultiIssueClassification(classification);
    const resolvedType =
      manualOverride && issueType
        ? issueType
        : issueType || (multiFromAi ? classification!.issueType : classification?.issueType);
    if (!resolvedType) {
      return toast.error(
        multiFromAi ? "Wait for AI detection to finish" : "Wait for AI detection or select an issue type",
      );
    }
    if (location.loading) {
      return toast.error("Waiting for live GPS — allow location access when prompted");
    }
    if (!location.isLive || location.lat == null || location.lng == null) {
      return toast.error("Live location required", {
        description: "Click “Refresh location” and allow location access for this site.",
      });
    }

    setProcessing(true);

    try {
      const formData = new FormData();
      formData.set("issueType", resolvedType);
      formData.set("manualOverride", String(manualOverride));
      formData.set("description", description.trim());
      formData.set("lat", String(location.lat));
      formData.set("lng", String(location.lng));
      formData.set("locationLabel", location.label);
      if (imageFile) formData.set("image", imageFile);

      const res = await submitReport({ data: formData });
      saveLastAnalysis(res);
      onSubmitted();
      void navigate({ to: "/analysis", search: { ticket: res.ticketId } });
      if (res.isMultiIssue && res.routed && res.issueBreakdown?.length) {
        toast.success("Multi-issue alert sent to all affected departments", {
          description: res.issueBreakdown
            .map((item) => `${ISSUE_META[item.issueType].label} ${item.percentage}%`)
            .join(" · "),
        });
      } else if (res.isMultiIssue && !res.routed && res.issueBreakdown?.length) {
        toast.success("Report queued for manual review", {
          description: `${res.issueBreakdown.map((item) => `${ISSUE_META[item.issueType].label} ${item.percentage}%`).join(" · ")} — admin will route departments`,
        });
      } else {
        toast.success(
          res.routed ? `Report routed to ${res.department}` : "Report sent to Manual Review Queue",
          { description: `Ticket ${res.ticketId} · Confidence ${(res.final * 100).toFixed(1)}%` },
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.startsWith("[")
            ? (() => {
                try {
                  const issues = JSON.parse(error.message) as Array<{ message?: string }>;
                  return issues.map((issue) => issue.message).filter(Boolean).join(". ") || "Failed to submit report";
                } catch {
                  return error.message;
                }
              })()
            : error.message
          : "Failed to submit report";
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setIssueType("");
    setDescription("");
    setImageFile(null);
    setImageUrl(null);
    setClassification(null);
    setClassifying(false);
    setClassifyingText(false);
    setManualOverride(false);
  };

  return (
    <>
      <section id="report" className="py-24 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl mb-10">
            <Badge variant="outline" className="mb-3 border-primary/40 text-primary bg-primary/5">Report Submission</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Submit a civic issue in under 30 seconds.</h2>
            <p className="mt-4 text-muted-foreground">
              Upload a photo, write a description, or both — at least one is required.{" "}
              <span className="text-foreground/90">Photo alone is enough:</span> vision can detect one or several issues
              (pothole, garbage, manhole) with no caption and route each to the right department.
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-6">
            <Card className="glass border-white/10 p-6 lg:col-span-3">
              <div className="space-y-2">
                <Label>Upload Image (optional if you describe the issue)</Label>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full rounded-xl border-2 border-dashed border-white/15 hover:border-primary/60 bg-white/5 transition-colors p-6 text-center group"
                >
                  {imageUrl ? (
                    <div className="flex flex-col items-center gap-3">
                      <img src={imageUrl} alt="upload preview" className="max-h-48 rounded-lg" />
                      <span className="text-xs text-muted-foreground">Click to replace image</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <div className="h-12 w-12 rounded-full bg-primary/10 grid place-items-center group-hover:bg-primary/20 transition-colors">
                        <Upload className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-sm">Click to upload — AI will classify automatically</div>
                      <div className="text-[11px]">PNG, JPG up to 10MB</div>
                    </div>
                  )}
                  <input
                    ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => onFile(e.target.files?.[0])}
                  />
                </button>
              </div>

              {(classifying || classifyingText || classification) && (
                <div className="mt-5 rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Eye className="h-4 w-4 text-primary" />
                    {imageFile ? "Vision Detection" : "Text Detection"}
                  </div>
                  {classifying || classifyingText ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Activity className="h-4 w-4 animate-pulse" />
                      {imageFile ? "Analyzing image…" : "Analyzing description…"}
                    </div>
                  ) : classification ? (
                    <div className="space-y-3">
                      {(() => {
                        const visible = getVisibleIssues(classification);
                        const multi = visible.length >= 2;
                        const modelBadge =
                          classification.modelSource === "cohere" ? (
                            <Badge variant="outline" className="border-violet-400/40 text-violet-300">Cohere Vision</Badge>
                          ) : classification.modelSource === "openai" ? (
                            <Badge variant="outline" className="border-primary/40 text-primary">OpenAI Vision</Badge>
                          ) : classification.modelSource === "local" ? (
                            <Badge variant="outline" className="border-emerald-400/40 text-emerald-300">Local ML Model</Badge>
                          ) : classification.modelSource === "heuristic" ? (
                            <Badge variant="outline" className="border-amber-400/40 text-amber-300">Keyword fallback</Badge>
                          ) : null;

                        if (multi) {
                          return (
                            <>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="border-violet-400/50 text-violet-200 bg-violet-500/10">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Multiple issues detected
                                </Badge>
                                {modelBadge}
                              </div>
                              <p className="text-xs text-muted-foreground">{classification.reason}</p>
                              <div className="rounded-lg bg-black/20 border border-violet-400/20 p-3 space-y-3">
                                {visible.map((item) => (
                                  <div key={item.type}>
                                    <div className="flex justify-between items-center text-sm mb-1.5">
                                      <Badge className={`bg-gradient-to-r ${ISSUE_META[item.type].color} text-background border-0`}>
                                        {ISSUE_META[item.type].label}
                                      </Badge>
                                      <span className="font-mono text-primary">{item.pct}%</span>
                                    </div>
                                    <Progress value={item.pct} className="h-1.5" />
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      → {ISSUE_META[item.type].department}
                                    </p>
                                  </div>
                                ))}
                              </div>
                              {hasBelowAutoRouteThreshold(classification) ? (
                                <p className="flex items-center gap-1.5 text-xs text-amber-300">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                  One or more issues are below {Math.round(MULTI_ISSUE_MIN_CONFIDENCE * 100)}%
                                  confidence — your report will go to{" "}
                                  <span className="font-medium">manual review</span> for an admin to route
                                  departments.
                                </p>
                              ) : (
                                <p className="flex items-center gap-1.5 text-xs text-emerald-300">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  All detected issues meet the threshold — multi-department routing on submit.
                                </p>
                              )}
                            </>
                          );
                        }

                        const top = getClassificationMix(classification)[0];
                        return (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={`bg-gradient-to-r ${ISSUE_META[classification.issueType].color} text-background border-0`}>
                                <Sparkles className="h-3 w-3 mr-1" />
                                {ISSUE_META[classification.issueType].label}
                              </Badge>
                              <span className="font-mono text-sm">{top?.pct ?? Math.round(classification.confidence * 100)}% confidence</span>
                              {modelBadge}
                            </div>
                            <p className="text-xs text-muted-foreground">{classification.reason}</p>
                            {issueType && !manualOverride && (
                              <p className="flex items-center gap-1.5 text-xs text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Issue type auto-confirmed as {ISSUE_META[issueType].label}
                              </p>
                            )}
                            {classification.confidence < 0.45 && !manualOverride && (
                              <p className="text-xs text-amber-400">Low confidence — you can change the type below if needed.</p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-5 mt-5">
                <div className="space-y-2">
                  <Label>
                    {classification && isMultiIssueClassification(classification) && !manualOverride
                      ? "Issue Type (optional override)"
                      : classification && issueType && !manualOverride
                        ? "Issue Type (auto-confirmed)"
                        : "Issue Type"}
                  </Label>
                  <Select
                    value={issueType || undefined}
                    onValueChange={(v) => handleIssueTypeChange(v as IssueType)}
                    disabled={classifying || classifyingText}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue
                        placeholder={
                          classifying || classifyingText
                            ? "Detecting…"
                            : classification && isMultiIssueClassification(classification)
                              ? "Multi-issue detected — override if needed"
                              : "Select or wait for AI"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pothole">🕳  Pothole</SelectItem>
                      <SelectItem value="garbage">🗑  Garbage Pileup</SelectItem>
                      <SelectItem value="manhole">⚠  Manhole Defect</SelectItem>
                    </SelectContent>
                  </Select>
                  {classification && isMultiIssueClassification(classification) && !manualOverride && (
                    <p className="text-xs text-muted-foreground">Leave unset to route all detected issues from the photo.</p>
                  )}
                  {classification && issueType && !manualOverride && !isMultiIssueClassification(classification) && (
                    <p className="text-xs text-muted-foreground">Filled automatically from your photo. Change only if wrong.</p>
                  )}
                  {manualOverride && (
                    <p className="text-xs text-amber-400">Manual override active — using your selection instead of AI.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>
                      Location{" "}
                      {location.loading
                        ? "(detecting…)"
                        : location.isLive
                          ? "(live GPS)"
                          : "(required)"}
                    </Label>
                    <Button type="button" variant="outline" size="sm" onClick={refreshLocation}>
                      Refresh location
                    </Button>
                  </div>
                  <div
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                      location.isLive
                        ? "bg-emerald-500/10 border-emerald-400/30"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <MapPin className={`h-4 w-4 ${location.isLive ? "text-emerald-400" : "text-accent"}`} />
                    <span className={location.isLive ? "text-emerald-100" : "text-muted-foreground"}>
                      {location.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mt-5">
                <div className="flex items-center justify-between">
                  <Label>Description (optional if you upload a photo)</Label>
                  <span className={`text-xs ${!imageFile && description.trim().length < 10 ? "text-amber-400" : "text-muted-foreground"}`}>
                    {description.trim().length}/10 {!imageFile ? "required" : "optional"}
                  </span>
                </div>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue — mention pothole, garbage, manhole, severity, hazards (min. 10 chars if no photo)..."
                  rows={4}
                  className="bg-white/5 border-white/10 resize-none"
                />
              </div>

              <div className="flex flex-wrap gap-3 mt-6">
                <Button size="lg" onClick={submit} disabled={processing || classifying || classifyingText} className="glow">
                  {processing ? (<><Activity className="mr-2 h-4 w-4 animate-pulse" />Analyzing...</>) : (<><Brain className="mr-2 h-4 w-4" />Run AI Analysis</>)}
                </Button>
                <Button size="lg" variant="outline" onClick={reset}>Reset</Button>
              </div>
            </Card>

            <Card className="glass border-white/10 p-6 lg:col-span-2">
              <div className="text-sm font-semibold mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" />Pipeline Preview</div>
              <ol className="space-y-4">
                {[
                  { i: Upload, t: "Citizen Submission", d: "Image + description + GPS" },
                  { i: Eye, t: "Vision Detection", d: "Classifies issue & severity" },
                  { i: Languages, t: "NLP Validation", d: "Confirms textual context" },
                  { i: Gauge, t: "Weighted Scoring", d: "0.7 × Vision + 0.3 × NLP" },
                  { i: Workflow, t: "Auto-Route / Review", d: "Threshold = 0.45" },
                ].map((s, i) => (
                  <li key={s.t} className="flex gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 grid place-items-center text-xs font-bold">{i + 1}</div>
                    <div>
                      <div className="text-sm font-medium flex items-center gap-2"><s.i className="h-3.5 w-3.5 text-primary" />{s.t}</div>
                      <div className="text-xs text-muted-foreground">{s.d}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}

export function AnalysisSection({
  result,
  processing,
}: {
  result: AnalysisResult | null;
  processing?: boolean;
}) {
  return (
    <section className="py-24 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl mb-10">
          <Badge variant="outline" className="mb-3 border-accent/40 text-accent bg-accent/5">AI Analysis Dashboard</Badge>
          <h2 className="text-3xl md:text-4xl font-bold">Multimodal scoring, decoded.</h2>
          <p className="mt-4 text-muted-foreground">Vision and NLP confidences are fused into a single weighted score that drives routing.</p>
        </div>

        {processing && <ProcessingPanel />}
        {!processing && !result && <EmptyState />}
        {!processing && result && <AnalysisPanel result={result} />}
      </div>
    </section>
  );
}

function ProcessingPanel() {
  return (
    <Card className="glass border-white/10 p-10 fade-up">
      <div className="flex flex-col items-center text-center gap-5">
        <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center pulse-ring">
          <Brain className="h-9 w-9 text-background" />
        </div>
        <div>
          <div className="text-lg font-semibold">Running multimodal inference…</div>
          <div className="text-sm text-muted-foreground">Vision · NLP · Geospatial fusion</div>
        </div>
        <div className="w-full max-w-md space-y-2">
          {["Decoding image features", "Parsing description context", "Computing weighted score", "Selecting department"].map((s, i) => (
            <div key={s} className="rounded-md bg-white/5 px-3 py-2 text-sm text-left flex items-center gap-2" style={{ animation: `fade-up 0.4s ${i * 0.3}s both` }}>
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span>{s}</span>
              <div className="ml-auto h-1 w-24 rounded-full bg-white/10 overflow-hidden"><div className="h-full shimmer w-full" /></div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="glass border-white/10 border-dashed p-12 text-center">
      <Brain className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-60" />
      <div className="text-sm text-muted-foreground mb-4">Submit a report to see multimodal AI scoring here.</div>
      <Link to="/report">
        <Button>Go to Report</Button>
      </Link>
    </Card>
  );
}

function AnalysisPanel({ result }: { result: AnalysisResult }) {
  const meta = ISSUE_META[result.issueType];
  const DeptIcon = ISSUE_UI[result.issueType].deptIcon;
  return (
    <div className="grid lg:grid-cols-3 gap-6 fade-up">
      <Card className="glass border-white/10 p-6 lg:col-span-2">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Detected Issue</div>
            <div className="text-2xl font-bold mt-1">
              {result.isMultiIssue ? "Multiple issues detected" : meta.label}
            </div>
          </div>
          <Badge className={`bg-gradient-to-r ${meta.color} text-background border-0`}>
            <Sparkles className="h-3 w-3 mr-1" />Classified
          </Badge>
        </div>

        {result.issueBreakdown && result.issueBreakdown.length > 0 && (
          <div className="mb-6 rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
            <div className="text-sm font-medium">Department notification breakdown</div>
            {result.issueBreakdown.map((item) => (
              <div key={item.issueType} className="flex items-center justify-between text-sm">
                <span>
                  {ISSUE_META[item.issueType].label} → {item.department}
                </span>
                <span className="font-mono text-primary">{item.percentage}%</span>
              </div>
            ))}
            {result.emailsSent ? (
              <p className="text-xs text-emerald-300">{result.emailsSent} department email(s) queued/sent.</p>
            ) : null}
          </div>
        )}

        <div className="space-y-5">
          <ScoreRow icon={Eye} label="Vision Confidence" value={result.vision} color="oklch(0.72 0.18 230)" />
          <ScoreRow icon={Languages} label="NLP Confidence" value={result.nlp} color="oklch(0.7 0.2 175)" />
          <div className="h-px bg-white/10 my-2" />
          <ScoreRow icon={Gauge} label="Weighted Final Score" value={result.final} color="oklch(0.75 0.18 90)" bold />
          <div className="text-xs text-muted-foreground font-mono bg-white/5 rounded-md px-3 py-2">
            Final = (Vision × 0.7) + (NLP × 0.3) = ({(result.vision).toFixed(2)} × 0.7) + ({(result.nlp).toFixed(2)} × 0.3) = {result.final.toFixed(3)}
          </div>
        </div>
      </Card>

      <Card className="glass border-white/10 p-6 flex flex-col">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Decision</div>
        {result.routed ? (
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-400/30 p-5 flex flex-col items-center text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-2" />
            <div className="font-semibold">{result.isMultiIssue ? "Multi-Department Alert" : "Auto Routed"}</div>
            <div className="text-xs text-muted-foreground mt-1">Score ≥ 0.45 threshold</div>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              {(result.notifiedDepartments ?? [result.department]).map((dept) => (
                <div key={dept} className="flex items-center justify-center gap-2">
                  <DeptIcon className="h-4 w-4 text-emerald-300" />
                  <span className="font-medium">{dept}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-400/30 p-5 flex flex-col items-center text-center">
            <AlertTriangle className="h-10 w-10 text-amber-400 mb-2" />
            <div className="font-semibold">Manual Review Queue</div>
            <div className="text-xs text-muted-foreground mt-1">Score &lt; 0.45 threshold</div>
            <div className="mt-4 text-sm">Awaiting officer triage</div>
          </div>
        )}
        <div className="mt-5 space-y-2 text-sm">
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Ticket</span><span className="font-mono">{result.ticketId}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Location</span><span>{result.location.label}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Coords</span><span className="font-mono text-xs">{result.location.lat.toFixed(4)}, {result.location.lng.toFixed(4)}</span></div>
        </div>
        <div className="mt-auto pt-5">
          <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-xs flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-primary" />
            Email + dashboard notifications sent to affected department(s).
          </div>
        </div>
      </Card>
    </div>
  );
}

function ScoreRow({ icon: Icon, label, value, color, bold }: {
  icon: typeof Eye; label: string; value: number; color: string; bold?: boolean;
}) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-2 text-sm">
        <span className={`flex items-center gap-2 ${bold ? "font-semibold" : ""}`}>
          <Icon className="h-4 w-4" style={{ color }} />{label}
        </span>
        <span className="font-mono" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, oklch(0.85 0.12 240))` }} />
      </div>
    </div>
  );
}

export function CivicFooter() {
  return (
    <footer className="border-t border-white/10 py-10">
      <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>CivicMind AI · Smart Governance Platform</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><Globe2 className="h-3.5 w-3.5" />Full Stack Build</span>
          <span className="flex items-center gap-1"><Github className="h-3.5 w-3.5" />Final-Year Project</span>
        </div>
      </div>
    </footer>
  );
}

