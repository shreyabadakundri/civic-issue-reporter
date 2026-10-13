import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
} from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ISSUE_META } from "@/lib/constants";
import type { ReportStatus } from "@/lib/constants";
import {
  changeReportStatus,
  fetchReports,
  getDashboardSummary,
  getEmailOutbox,
} from "@/server/reports";

export const Route = createFileRoute("/admin/")({
  component: AdminPage,
  loader: async () => getDashboardSummary(),
});

const STATUS_OPTIONS: ReportStatus[] = [
  "submitted",
  "routed",
  "manual_review",
  "in_progress",
  "resolved",
  "closed",
];

function AdminPage() {
  const summary = Route.useLoaderData();
  const queryClient = useQueryClient();

  const reportsQuery = useQuery({
    queryKey: ["admin-reports"],
    queryFn: () => fetchReports({ data: { limit: 100 } }),
  });

  const emailQuery = useQuery({
    queryKey: ["admin-emails"],
    queryFn: () => getEmailOutbox(),
  });

  const statusMutation = useMutation({
    mutationFn: (payload: { id: string; status: ReportStatus }) =>
      changeReportStatus({ data: { ...payload, note: `Status changed to ${payload.status} by admin` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      toast.success("Ticket status updated");
    },
    onError: () => toast.error("Failed to update ticket"),
  });

  return (
    <div className="min-h-screen text-foreground">
      <SiteNav variant="portal" />
      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge variant="outline" className="mb-3 border-primary/40 text-primary bg-primary/5">
              Operations Console
            </Badge>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="mt-2 text-muted-foreground">
              Monitor tickets, triage manual review, and track department workload.
            </p>
          </div>
          <Link to="/">
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to site</Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          {[
            { label: "Total Reports", value: summary.stats.totalReports, icon: Building2 },
            { label: "Auto-Route Rate", value: `${summary.stats.autoRouteRate}%`, icon: Activity },
            { label: "Resolved", value: summary.stats.resolvedCount, icon: CheckCircle2 },
            { label: "Manual Review", value: summary.byStatus.manual_review ?? 0, icon: Clock },
          ].map((stat) => (
            <Card key={stat.label} className="glass border-white/10 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{stat.label}</div>
                  <div className="text-2xl font-bold mt-1">{stat.value}</div>
                </div>
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
            </Card>
          ))}
        </div>

        <Card className="glass border-white/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <div className="font-semibold">Department Email Outbox</div>
              <p className="text-sm text-muted-foreground mt-1">
                Preview emails sent to Public Works, Sanitation, and Sewer Maintenance (demo panel).
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => emailQuery.refetch()}>
              <RefreshCw className={`mr-2 h-4 w-4 ${emailQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {(emailQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No emails yet — submit a report to generate alerts.</p>
            ) : (
              (emailQuery.data ?? []).map((email) => (
                <details key={email.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    {email.subject}{" "}
                    <Badge variant="outline" className="ml-2 text-xs">
                      {email.delivery}
                    </Badge>
                  </summary>
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    <div>To: {email.to}</div>
                    <div>Department: {email.department}</div>
                    <div>Ticket: {email.reportId}</div>
                  </div>
                  <div
                    className="mt-3 rounded-md bg-black/30 p-3 text-xs prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: email.html }}
                  />
                </details>
              ))
            )}
          </div>
        </Card>

        <Card className="glass border-white/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4" /> All Tickets
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => reportsQuery.refetch()}
              disabled={reportsQuery.isFetching}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${reportsQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead>Ticket</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(reportsQuery.data ?? summary.recent).map((report) => (
                <TableRow key={report.id} className="border-white/10">
                  <TableCell>
                    <Link to="/reports/$id" params={{ id: report.id }} className="font-mono text-primary hover:underline">
                      {report.id}
                    </Link>
                  </TableCell>
                  <TableCell>{ISSUE_META[report.issueType].label}</TableCell>
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
