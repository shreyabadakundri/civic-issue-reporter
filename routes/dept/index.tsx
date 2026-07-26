import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Droplets, Siren, Trash2, Wrench } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SiteNav } from "@/components/civic/site-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEPARTMENTS, ISSUE_META, type Department, type ReportStatus } from "@/lib/constants";
import { changeReportStatus, fetchReports } from "@/server/reports";

export const Route = createFileRoute("/dept/")({
  component: DeptPage,
});

const DEPT_ICONS = {
  "Public Works": Wrench,
  Sanitation: Trash2,
  "Sewer Maintenance": Droplets,
} as const;

function DeptPage() {
  const [department, setDepartment] = useState<Department>("Public Works");
  const queryClient = useQueryClient();

  const queueQuery = useQuery({
    queryKey: ["dept-queue", department],
    queryFn: () => fetchReports({ data: { department, limit: 50 } }),
  });

  const statusMutation = useMutation({
    mutationFn: (payload: { id: string; status: ReportStatus }) =>
      changeReportStatus({
        data: { ...payload, note: `${department} updated status to ${payload.status}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dept-queue", department] });
      toast.success("Ticket updated");
    },
  });

  const active = (queueQuery.data ?? []).filter((report) =>
    ["routed", "in_progress", "manual_review"].includes(report.status),
  );

  const DeptIcon = DEPT_ICONS[department];

  return (
    <div className="min-h-screen text-foreground">
      <SiteNav variant="portal" />
      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge variant="outline" className="mb-3 border-accent/40 text-accent bg-accent/5">
              Department Portal
            </Badge>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <DeptIcon className="h-8 w-8 text-primary" />
              {department}
            </h1>
            <p className="mt-2 text-muted-foreground">
              Manage incoming civic tickets assigned to your department.
            </p>
          </div>
          <Link to="/">
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to site</Button>
          </Link>
        </div>

        <Card className="glass border-white/10 p-4">
          <Select value={department} onValueChange={(value) => setDepartment(value as Department)}>
            <SelectTrigger className="max-w-xs bg-white/5 border-white/10">
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((dept) => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        <div className="grid md:grid-cols-3 gap-4">
          <Card className="glass border-white/10 p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Active Queue</div>
            <div className="text-3xl font-bold mt-2">{active.length}</div>
          </Card>
          <Card className="glass border-white/10 p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">In Progress</div>
            <div className="text-3xl font-bold mt-2">
              {active.filter((r) => r.status === "in_progress").length}
            </div>
          </Card>
          <Card className="glass border-white/10 p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Needs Review</div>
            <div className="text-3xl font-bold mt-2">
              {active.filter((r) => r.status === "manual_review").length}
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {active.length === 0 && (
            <Card className="glass border-white/10 border-dashed p-10 text-center lg:col-span-2">
              <div className="text-muted-foreground">No active tickets for {department}.</div>
            </Card>
          )}

          {active.map((report) => (
            <Card key={report.id} className="glass border-white/10 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-sm text-primary">{report.id}</div>
                  <div className="font-semibold mt-1">{ISSUE_META[report.issueType].label}</div>
                  <div className="text-sm text-muted-foreground mt-1">{report.locationLabel}</div>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  <Siren className="h-3 w-3 mr-1" />
                  {Math.round(report.finalScore * 100)}%
                </Badge>
              </div>

              <p className="text-sm mt-4 line-clamp-3">{report.description}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => statusMutation.mutate({ id: report.id, status: "in_progress" })}
                >
                  Start Work
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => statusMutation.mutate({ id: report.id, status: "resolved" })}
                >
                  Mark Resolved
                </Button>
                <Link to="/reports/$id" params={{ id: report.id }}>
                  <Button size="sm" variant="ghost">Details</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
