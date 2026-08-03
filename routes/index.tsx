import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Brain, Building2, CheckCircle2,
  Cpu, Eye, Gauge, Github, Globe2, Languages, MapPin, Radio, Shield,
  ShieldCheck, Siren, Sparkles, Trash2, Upload, Workflow, Wrench, Droplets,
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
import { toast, Toaster } from "sonner";

import { SiteNav } from "@/components/civic/site-nav";
import { useLocalClassifier } from "@/hooks/use-local-classifier";
import { ISSUE_META, type IssueType } from "@/lib/constants";
import type { AnalysisResult, ImageClassificationResult } from "@/lib/types";
import { classifyReportImage, getQueues, getStats, submitReport } from "@/server/reports";

export const Route = createFileRoute("/")({
  component: Index,
  loader: async () => {
    const [stats, queues] = await Promise.all([getStats(), getQueues()]);
    return { stats, queues };
  },
});

const ISSUE_UI = {
  pothole: { deptIcon: Wrench },
  garbage: { deptIcon: Trash2 },
  manhole: { deptIcon: Droplets },
} as const;

function Hero({ stats }: { stats: Awaited<ReturnType<typeof getStats>> }) {
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
              <a href="#report"><Button size="lg" className="glow">Report a Civic Issue<ArrowRight className="ml-2 h-4 w-4" /></Button></a>
              <a href="#about"><Button size="lg" variant="outline">How it works</Button></a>
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

function About() {
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
  lat: number;
  lng: number;
  label: string;
  loading: boolean;
};

function ReportFlow({
  initialQueues,
  onSubmitted,
}: {
  initialQueues: Awaited<ReturnType<typeof getQueues>>;
  onSubmitted: () => void;
}) {
  const [issueType, setIssueType] = useState<IssueType | "">("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [classification, setClassification] = useState<ImageClassificationResult | null>(null);
  const [manualOverride, setManualOverride] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [queues, setQueues] = useState(initialQueues);
  const [location, setLocation] = useState<LocationState>({
    lat: 28.6139,
    lng: 77.209,
    label: "Detecting location…",
    loading: true,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const analysisRef = useRef<HTMLDivElement>(null);
  const localClassifier = useLocalClassifier();

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({ lat: 28.6139, lng: 77.209, label: "Sector 14, Civic Zone (default)", loading: false });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: `GPS · ${pos.coords.latitude.toFixed(4)}°, ${pos.coords.longitude.toFixed(4)}°`,
          loading: false,
        });
      },
      () => {
        setLocation({ lat: 28.6139, lng: 77.209, label: "Sector 14, Civic Zone (fallback)", loading: false });
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const classifyImage = async (file: File, desc?: string) => {
    setClassifying(true);
    setClassification(null);
    setIssueType("");
    setManualOverride(false);

    try {
      if (localClassifier.ready) {
        const localResult = await localClassifier.classify(file);
        if (localResult) {
          setClassification(localResult);
          setIssueType(localResult.issueType);
          toast.success(`Auto-confirmed: ${ISSUE_META[localResult.issueType].label}`, {
            description: `${Math.round(localResult.confidence * 100)}% · Local trained model`,
          });
          return;
        }
      }

      const formData = new FormData();
      formData.set("image", file);
      if (desc?.trim()) formData.set("description", desc.trim());

      const result = await classifyReportImage({ data: formData });
      setClassification(result);
      setIssueType(result.issueType);
      toast.success(`Auto-confirmed: ${ISSUE_META[result.issueType].label}`, {
        description: `${Math.round(result.confidence * 100)}% confidence · ${result.reason}`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not classify image");
    } finally {
      setClassifying(false);
    }
  };

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
    if (!imageFile) return toast.error("Please upload an image of the issue");
    if (classifying) return toast.error("Please wait for image classification to finish");
    if (!issueType) return toast.error("Upload a photo so AI can detect the issue type");

    if (description.trim().length < 10) {
      return toast.error("Description must be at least 10 characters");
    }

    setProcessing(true);
    setResult(null);
    setTimeout(() => analysisRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const formData = new FormData();
      formData.set("issueType", issueType);
      formData.set("manualOverride", String(manualOverride));
      formData.set("description", description.trim());
      formData.set("lat", String(location.lat));
      formData.set("lng", String(location.lng));
      formData.set("locationLabel", location.label);
      formData.set("image", imageFile);

      const res = await submitReport({ data: formData });
      setResult(res);
      const updatedQueues = await getQueues();
      setQueues(updatedQueues);
      onSubmitted();
      toast.success(
        res.routed ? `Report routed to ${res.department}` : "Report sent to Manual Review Queue",
        { description: `Ticket ${res.ticketId} · Confidence ${(res.final * 100).toFixed(1)}%` },
      );
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
    setManualOverride(false);
    setResult(null);
  };

  return (
    <>
      <section id="report" className="py-24 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl mb-10">
            <Badge variant="outline" className="mb-3 border-primary/40 text-primary bg-primary/5">Report Submission</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Submit a civic issue in under 30 seconds.</h2>
            <p className="mt-4 text-muted-foreground">Upload a photo — AI auto-detects the issue type. Add a short description and confirm your location.</p>
          </div>

          <div className="grid lg:grid-cols-5 gap-6">
            <Card className="glass border-white/10 p-6 lg:col-span-3">
              <div className="space-y-2">
                <Label>Upload Image</Label>
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

              {localClassifier.missing && !localClassifier.loading && (
                <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                  No trained model yet. Run <code className="font-mono text-xs">python ml/train.py</code> after adding photos — see <code className="font-mono text-xs">ml/README.md</code>.
                </div>
              )}

              {(classifying || classification) && (
                <div className="mt-5 rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Eye className="h-4 w-4 text-primary" />
                    Vision Detection
                  </div>
                  {classifying ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Activity className="h-4 w-4 animate-pulse" />
                      Analyzing image and classifying issue type…
                    </div>
                  ) : classification ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`bg-gradient-to-r ${ISSUE_META[classification.issueType].color} text-background border-0`}>
                          <Sparkles className="h-3 w-3 mr-1" />
                          {ISSUE_META[classification.issueType].label}
                        </Badge>
                        <span className="font-mono text-sm">{Math.round(classification.confidence * 100)}% confidence</span>
                        {classification.modelSource === "openai" && (
                          <Badge variant="outline" className="border-primary/40 text-primary">OpenAI Vision</Badge>
                        )}
                        {classification.modelSource === "local" && (
                          <Badge variant="outline" className="border-emerald-400/40 text-emerald-300">Local ML Model</Badge>
                        )}
                        {classification.modelSource === "heuristic" && (
                          <Badge variant="outline" className="border-amber-400/40 text-amber-300">Keyword fallback</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{classification.reason}</p>
                      {issueType && (
                        <p className="flex items-center gap-1.5 text-xs text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Issue type auto-confirmed as {ISSUE_META[issueType].label}
                          {manualOverride ? " (you changed it)" : ""}
                        </p>
                      )}
                      {classification.confidence < 0.45 && !manualOverride && (
                        <p className="text-xs text-amber-400">Low confidence — you can change the type below if needed.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-5 mt-5">
                <div className="space-y-2">
                  <Label>
                    {classification && issueType && !manualOverride
                      ? "Issue Type (auto-confirmed)"
                      : classification
                        ? "Issue Type"
                        : "Issue Type"}
                  </Label>
                  <Select
                    value={issueType || undefined}
                    onValueChange={(v) => handleIssueTypeChange(v as IssueType)}
                    disabled={classifying || !imageFile}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue placeholder={classifying ? "Detecting from photo…" : "Upload a photo first"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pothole">🕳  Pothole</SelectItem>
                      <SelectItem value="garbage">🗑  Garbage Pileup</SelectItem>
                      <SelectItem value="manhole">⚠  Manhole Defect</SelectItem>
                    </SelectContent>
                  </Select>
                  {classification && issueType && !manualOverride && (
                    <p className="text-xs text-muted-foreground">Filled automatically from your photo. Change only if wrong.</p>
                  )}
                  {manualOverride && (
                    <p className="text-xs text-amber-400">Manual override active — using your selection instead of AI.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Location {location.loading ? "(detecting…)" : "(GPS)"}</Label>
                  <div className="flex items-center gap-2 rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm">
                    <MapPin className="h-4 w-4 text-accent" />
                    <span className="text-muted-foreground">{location.label}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mt-5">
                <div className="flex items-center justify-between">
                  <Label>Description</Label>
                  <span className={`text-xs ${description.trim().length < 10 ? "text-amber-400" : "text-muted-foreground"}`}>
                    {description.trim().length}/10 min
                  </span>
                </div>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue — size, severity, hazards, traffic impact (min. 10 characters)..."
                  rows={4}
                  className="bg-white/5 border-white/10 resize-none"
                />
              </div>

              <div className="flex flex-wrap gap-3 mt-6">
                <Button size="lg" onClick={submit} disabled={processing || classifying} className="glow">
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

      <section id="analysis" className="py-24 border-t border-white/5" ref={analysisRef}>
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

      <section id="routing" className="py-24 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl mb-10">
            <Badge variant="outline" className="mb-3 border-primary/40 text-primary bg-primary/5">Routing Status</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Department dispatch & live queue.</h2>
            <p className="mt-4 text-muted-foreground">Auto-routed tickets land in the right department instantly. Borderline cases get human eyes.</p>
          </div>
          <RoutingBoard result={result} queues={queues} />
        </div>
      </section>
    </>
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
      <div className="text-sm text-muted-foreground">Submit a report above to see the AI analysis result.</div>
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
            <div className="text-2xl font-bold mt-1">{meta.label}</div>
          </div>
          <Badge className={`bg-gradient-to-r ${meta.color} text-background border-0`}>
            <Sparkles className="h-3 w-3 mr-1" />Classified
          </Badge>
        </div>

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
            <div className="font-semibold">Auto Routed</div>
            <div className="text-xs text-muted-foreground mt-1">Score ≥ 0.45 threshold</div>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <DeptIcon className="h-4 w-4 text-emerald-300" />
              <span className="font-medium">{result.department}</span>
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
            Notification sent to citizen & department dashboard.
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

function RoutingBoard({
  result,
  queues,
}: {
  result: AnalysisResult | null;
  queues: Awaited<ReturnType<typeof getQueues>>;
}) {
  const departments = [
    { key: "Public Works", icon: Wrench, color: "from-amber-400/20 to-orange-500/10 border-amber-400/30", iconColor: "text-amber-300" },
    { key: "Sanitation", icon: Trash2, color: "from-emerald-400/20 to-teal-500/10 border-emerald-400/30", iconColor: "text-emerald-300" },
    { key: "Sewer Maintenance", icon: Droplets, color: "from-sky-400/20 to-blue-500/10 border-sky-400/30", iconColor: "text-sky-300" },
  ] as const;

  const manualReview = [...queues.manualReview];
  if (result && !result.routed && !manualReview.some((item) => item.ticketId === result.ticketId)) {
    manualReview.unshift(result);
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      {departments.map((d) => {
        const queueData = queues.departments.find((item) => item.department === d.key);
        const active = result?.routed && result.department === d.key;
        const queue = (queueData?.activeQueue ?? 0) + (active ? 1 : 0);
        return (
          <Card key={d.key} className={`relative bg-gradient-to-br ${d.color} border p-6 ${active ? "ring-2 ring-primary glow" : ""}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white/10 grid place-items-center"><d.icon className={`h-5 w-5 ${d.iconColor}`} /></div>
                <div>
                  <div className="font-semibold">{d.key}</div>
                  <div className="text-xs text-muted-foreground">Department</div>
                </div>
              </div>
              {active && <Badge className="bg-emerald-500/30 text-emerald-100 border-emerald-400/40"><Siren className="h-3 w-3 mr-1" />Incoming</Badge>}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-white/5 p-3">
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Active Queue</div>
                <div className="text-xl font-bold mt-1">{queue}</div>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider">SLA</div>
                <div className="text-xl font-bold mt-1">24h</div>
              </div>
            </div>
            {active && (
              <div className="mt-4 rounded-lg bg-white/10 border border-white/15 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <Link to="/reports/$id" params={{ id: result.ticketId }} className="font-mono hover:underline">
                    {result.ticketId}
                  </Link>
                  <Badge variant="outline" className="border-emerald-400/40 text-emerald-300">Priority</Badge>
                </div>
                <div className="text-muted-foreground mt-1">{result.location.label}</div>
              </div>
            )}
          </Card>
        );
      })}

      <Card className="glass border-white/10 p-6 lg:col-span-3">
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />Manual Review Queue</div>
          <Badge variant="secondary">{manualReview.length} pending</Badge>
        </div>
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          {manualReview.slice(0, 6).map((it) => (
            <div key={it.ticketId} className="rounded-lg bg-white/5 border border-white/10 p-3">
              <div className="flex items-center justify-between">
                <Link to="/reports/$id" params={{ id: it.ticketId }} className="font-mono text-xs hover:underline">
                  {it.ticketId}
                </Link>
                <Badge variant="outline" className="border-amber-400/40 text-amber-300">Review</Badge>
              </div>
              <div className="mt-2">{ISSUE_META[it.issueType].label}</div>
              <div className="text-xs text-muted-foreground">
                Score {(it.final * 100).toFixed(0)}% · below threshold
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Footer() {
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

function Index() {
  const { stats, queues } = Route.useLoaderData();
  const router = useRouter();

  return (
    <div className="min-h-screen text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <SiteNav />
      <main>
        <Hero stats={stats} />
        <About />
        <ReportFlow initialQueues={queues} onSubmitted={() => router.invalidate()} />
      </main>
      <Footer />
    </div>
  );
}
