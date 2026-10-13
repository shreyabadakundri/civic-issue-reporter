import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Clock,
  Filter,
  LogOut,
  RefreshCw,
  Send,
} from "lucide-react";
import { toast, Toaster } from "sonner";

import { AdminAnalyticsDashboard } from "@/components/civic/admin-analytics-dashboard";
import { AuthGate } from "@/components/civic/auth-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { DEPARTMENTS, ISSUE_META } from "@/lib/constants";
import type { Department, IssueType, ReportStatus } from "@/lib/constants";
import type { ReportRecord } from "@/lib/types";
import {
  adminRouteManualReview,
  changeReportStatus,
  fetchReports,
  getAdminAnalytics,
  getEmailOutbox,
} from "@/server/reports";

export const Route = createFileRoute("/admin/")({
  component: AdminPage,
});

const STATUS_OPTIONS: ReportStatus[] = [
  "submitted",
  "routed",
  "manual_review",
  "in_progress",
  "resolved",
  "closed",
];

function ManualReviewCard({
  report,
  authToken,
  onRouted,
}: {
  report: ReportRecord;
  authToken: string;
  onRouted: () => void;
}) {
  const defaultDept = ISSUE_META[report.issueType].department as Department;
  const [department, setDepartment] = useState<Department>(report.department || defaultDept);
  const [issueType, setIssueType] = useState<IssueType>(report.issueType);
  const [note, setNote] = useState("");

  const routeMutation = useMutation({
    mutationFn: () =>
      adminRouteManualReview({
        data: {
          id: report.id,
          department,
          issueType,
          note: note.trim() || undefined,
          authToken,
        },
      }),
    onSuccess: (updated) => {
      toast.success(`Routed ${updated.id} to ${updated.department}`);
      onRouted();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not route ticket");
    },
  });

  return (
    <Card className="border-amber-400/25 bg-amber-500/5 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-4 min-w-0 flex-1">
          {report.imagePath && !report.imagePath.includes("demo-placeholder") ? (
            <a href={report.imagePath} target="_blank" rel="noreferrer" className="shrink-0">
              <img
                src={report.imagePath}
                alt="Report"
                className="h-24 w-24 rounded-lg object-cover border border-white/15"
              />
            </a>
          ) : null}
          <div className="min-w-0">
            <Link to="/reports/$id" params={{ id: report.id }} className="font-mono text-primary hover:underline">
              {report.id}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{report.description}</p>
            {report.lastStatusNote ? (
              <p className="mt-1 text-xs text-amber-200/90">{report.lastStatusNote}</p>
            ) : null}
            {report.issueBreakdown && report.issueBreakdown.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {report.issueBreakdown.map((item) => (
                  <Badge key={item.issueType} variant="outline" className="border-white/20 text-xs">
                    {ISSUE_META[item.issueType].label} {item.percentage}%
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <Badge variant="outline" className="border-amber-400/40 text-amber-200">
          manual review
        </Badge>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Issue type</Label>
          <Select value={issueType} onValueChange={(v) => setIssueType(v as IssueType)}>
            <SelectTrigger className="bg-white/5 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ISSUE_META) as IssueType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {ISSUE_META[type].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Route to department</Label>
          <Select value={department} onValueChange={(v) => setDepartment(v as Department)}>
            <SelectTrigger className="bg-white/5 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Admin note (optional)</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="bg-white/5 border-white/10 resize-none"
          />
        </div>
      </div>
      <Button className="glow" disabled={routeMutation.isPending} onClick={() => routeMutation.mutate()}>
        {routeMutation.isPending ? (
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-2 h-4 w-4" />
        )}
        Confirm &amp; route
      </Button>
    </Card>
  );
}

function AdminDashboard() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const authToken = session!.token;
  const queryClient = useQueryClient();

  const analyticsQuery = useQuery({
    queryKey: ["admin-analytics", authToken],
    queryFn: () => getAdminAnalytics({ data: { authToken } }),
  });

  const reportsQuery = useQuery({
    queryKey: ["admin-reports", authToken],
    queryFn: () => fetchReports({ data: { limit: 100, authToken } }),
  });

  const manualReviewQuery = useQuery({
    queryKey: ["admin-manual-review", authToken],
    queryFn: () =>
      fetchReports({ data: { status: "manual_review", limit: 50, authToken } }),
  });

  const manualReviewReports =
    manualReviewQuery.data ??
    (reportsQuery.data ?? []).filter((report) => report.status === "manual_review");

  const emailQuery = useQuery({
    queryKey: ["admin-emails", authToken],
    queryFn: () => getEmailOutbox({ data: { authToken } }),
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
    queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    queryClient.invalidateQueries({ queryKey: ["admin-manual-review"] });
    queryClient.invalidateQueries({ queryKey: ["admin-emails"] });
  };

  const statusMutation = useMutation({
    mutationFn: (payload: { id: string; status: ReportStatus }) =>
      changeReportStatus({
        data: {
          ...payload,
          authToken,
          note: `Status changed to ${payload.status} by admin`,
        },
      }),
    onSuccess: () => {
      refreshAll();
      toast.success("Ticket status updated");
    },
  });

  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-50 glass border-b border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between gap-4">
          <div className="text-sm font-semibold">Admin Command Center</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={refreshAll}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Link to="/">
              <Button size="sm" variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Citizen site
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                logout();
                void navigate({ to: "/login" });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 space-y-10">
        {analyticsQuery.data && <AdminAnalyticsDashboard analytics={analyticsQuery.data} />}

        <Card className="glass border-white/10 p-6 space-y-4">
          <div className="font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-300" />
            Manual Review Queue
          </div>
          {manualReviewQuery.isError ? (
            <p className="text-sm text-amber-300 text-center py-6 border border-dashed border-amber-400/30 rounded-lg">
              Could not load manual review queue — refresh the page or sign in again.
            </p>
          ) : manualReviewReports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 border border-dashed border-white/15 rounded-lg">
              No tickets in manual review.
            </p>
          ) : (
            manualReviewReports.map((report) => (
              <ManualReviewCard
                key={report.id}
                report={report}
                authToken={authToken}
                onRouted={refreshAll}
              />
            ))
          )}
        </Card>

        <Card className="glass border-white/10 p-6">
          <div className="font-semibold mb-4">Email outbox</div>
          <div className="space-y-2 max-h-64 overflow-y-auto text-sm">
            {(emailQuery.data ?? []).map((email) => (
              <div key={email.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                {email.subject}
              </div>
            ))}
          </div>
        </Card>

        <Card className="glass border-white/10 p-6">
          <div className="font-semibold flex items-center gap-2 mb-5">
            <Filter className="h-4 w-4" /> All tickets
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead>Ticket</TableHead>
                <TableHead>Diagnosis</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(reportsQuery.data ?? []).map((report) => (
                <TableRow key={report.id} className="border-white/10">
                  <TableCell>
                    <Link to="/reports/$id" params={{ id: report.id }} className="font-mono text-primary hover:underline">
                      {report.id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {report.isMultiIssue ? "Multi-issue" : ISSUE_META[report.issueType].label}
                  </TableCell>
                  <TableCell>{report.department}</TableCell>
                  <TableCell>{Math.round(report.finalScore * 100)}%</TableCell>
                  <TableCell>
                    <Badge variant="outline">{report.status.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={report.status}
                      onValueChange={(status) =>
                        statusMutation.mutate({ id: report.id, status: status as ReportStatus })
                      }
                    >
                      <SelectTrigger className="w-[160px] bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </main>
    </div>
  );
}

function AdminPage() {
  return (
    <>
      <Toaster theme="dark" position="top-right" richColors />
      <AuthGate allow={["admin"]}>
        <AdminDashboard />
      </AuthGate>
    </>
  );
}
