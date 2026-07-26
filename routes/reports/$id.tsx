import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, MapPin } from "lucide-react";

import { SiteNav } from "@/components/civic/site-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ISSUE_META } from "@/lib/constants";
import { fetchReport } from "@/server/reports";

export const Route = createFileRoute("/reports/$id")({
  component: ReportDetailPage,
  loader: async ({ params }) => {
    try {
      return await fetchReport({ data: { id: params.id } });
    } catch {
      throw notFound();
    }
  },
});

function ReportDetailPage() {
  const { report, history } = Route.useLoaderData();
  const meta = ISSUE_META[report.issueType];

  return (
    <div className="min-h-screen text-foreground">
      <SiteNav variant="portal" />
      <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge variant="outline" className="mb-3 border-primary/40 text-primary bg-primary/5">
              Ticket Tracking
            </Badge>
            <h1 className="text-3xl font-bold font-mono">{report.id}</h1>
            <p className="mt-2 text-muted-foreground">{meta.label} · {report.department}</p>
          </div>
          <Link to="/">
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to site</Button>
          </Link>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="glass border-white/10 p-6 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Status</div>
              <Badge className="mt-2">{report.status.replace("_", " ")}</Badge>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Description</div>
              <p className="mt-2 text-sm">{report.description}</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-accent" />
              {report.locationLabel} ({report.lat.toFixed(4)}, {report.lng.toFixed(4)})
            </div>
            {report.imagePath && (
              <img
                src={report.imagePath}
                alt="Report evidence"
                className="rounded-xl max-h-64 w-full object-cover border border-white/10"
              />
            )}
          </Card>

          <Card className="glass border-white/10 p-6 space-y-5">
            <div className="font-semibold">AI Analysis</div>
            {[
              { label: "Vision Confidence", value: report.visionScore },
              { label: "NLP Confidence", value: report.nlpScore },
              { label: "Final Score", value: report.finalScore },
            ].map((score) => (
              <div key={score.label}>
                <div className="flex justify-between text-sm mb-2">
                  <span>{score.label}</span>
                  <span className="font-mono">{Math.round(score.value * 100)}%</span>
                </div>
                <Progress value={Math.round(score.value * 100)} className="h-2" />
              </div>
            ))}
            <div className="rounded-lg bg-white/5 p-3 text-sm">
              {report.routed
                ? "Auto-routed based on confidence threshold."
                : "Sent to manual review queue due to low confidence."}
            </div>
          </Card>
        </div>

        <Card className="glass border-white/10 p-6">
          <div className="font-semibold mb-4">Status Timeline</div>
          <ol className="space-y-4">
            {history.map((entry) => (
              <li key={entry.id} className="flex gap-3">
                <div className="h-8 w-8 shrink-0 rounded-full bg-primary/20 grid place-items-center text-xs font-bold">
                  {entry.status.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium capitalize">{entry.status.replace("_", " ")}</div>
                  {entry.note && <div className="text-sm text-muted-foreground">{entry.note}</div>}
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(entry.createdAt).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </main>
    </div>
  );
}
