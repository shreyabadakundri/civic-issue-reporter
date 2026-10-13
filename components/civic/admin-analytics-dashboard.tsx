import { Link } from "@tanstack/react-router";
import {
  Activity,
  Brain,
  Droplets,
  Layers,
  Sparkles,
  Trash2,
  TrendingUp,
  Wrench,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { ISSUE_META } from "@/lib/constants";
import type { AdminAnalytics } from "@/lib/admin-analytics";
import type { IssueType } from "@/lib/constants";

const ISSUE_ICONS = {
  pothole: Wrench,
  garbage: Trash2,
  manhole: Droplets,
} as const;

const ISSUE_CHART_COLORS: Record<IssueType, string> = {
  pothole: "oklch(0.75 0.18 55)",
  garbage: "oklch(0.72 0.16 165)",
  manhole: "oklch(0.7 0.15 240)",
};

type Props = {
  analytics: AdminAnalytics;
};

export function AdminAnalyticsDashboard({ analytics }: Props) {
  const issuePie = (Object.keys(ISSUE_META) as IssueType[]).map((type) => ({
    type,
    name: ISSUE_META[type].label,
    value: analytics.byIssueType[type],
    fill: ISSUE_CHART_COLORS[type],
  }));

  const statusBar = Object.entries(analytics.byStatus)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      status: status.replace("_", " "),
      count,
    }));

  const deptBar = Object.entries(analytics.byDepartment).map(([name, count]) => ({
    name: name.replace(" Maintenance", ""),
    count,
  }));

  const totalIssues = issuePie.reduce((a, b) => a + b.value, 0) || 1;

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 glass p-8 glow">
        <div className="absolute -z-10 -right-20 -top-20 h-56 w-56 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute -z-10 -left-16 bottom-0 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Badge variant="outline" className="mb-4 border-primary/40 text-primary bg-primary/5">
              <Sparkles className="h-3 w-3 mr-1" /> Live intelligence
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Civic AI{" "}
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Operations Pulse
              </span>
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl">
              Every report processed, diagnosed, and routed — vision + NLP outcomes in one command view.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-300">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            Streaming from datastore
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "Reports processed",
            value: analytics.stats.totalReports.toLocaleString(),
            sub: "All-time submissions",
            icon: Layers,
            accent: "from-primary/30 to-primary/5",
          },
          {
            label: "AI diagnoses",
            value: totalIssues.toLocaleString(),
            sub: `${analytics.multiIssueCount} multi-issue`,
            icon: Brain,
            accent: "from-violet-500/30 to-violet-500/5",
          },
          {
            label: "Auto-routed",
            value: `${analytics.stats.autoRouteRate}%`,
            sub: `${analytics.autoRoutedCount} tickets`,
            icon: Zap,
            accent: "from-emerald-500/30 to-emerald-500/5",
          },
          {
            label: "Avg confidence",
            value: `${analytics.avgConfidencePct}%`,
            sub: `~${(analytics.stats.avgLatencyMs / 1000).toFixed(1)}s AI latency`,
            icon: TrendingUp,
            accent: "from-amber-500/30 to-amber-500/5",
          },
        ].map((stat) => (
          <Card
            key={stat.label}
            className={`relative overflow-hidden border-white/10 bg-gradient-to-br ${stat.accent} p-5`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{stat.label}</div>
                <div className="text-3xl font-bold mt-2 tabular-nums">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.sub}</div>
              </div>
              <stat.icon className="h-5 w-5 text-primary opacity-80" />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="glass border-white/10 p-6 lg:col-span-1">
          <div className="font-semibold mb-1 flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" />
            Diagnosis mix
          </div>
          <p className="text-xs text-muted-foreground mb-4">What the AI classified (primary issue type)</p>
          <ChartContainer
            config={{
              pothole: { label: "Pothole", color: ISSUE_CHART_COLORS.pothole },
              garbage: { label: "Garbage", color: ISSUE_CHART_COLORS.garbage },
              manhole: { label: "Manhole", color: ISSUE_CHART_COLORS.manhole },
            }}
            className="mx-auto aspect-square max-h-[260px]"
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie data={issuePie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={3}>
                {issuePie.map((entry) => (
                  <Cell key={entry.type} fill={entry.fill} stroke="transparent" />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="mt-4 space-y-2">
            {issuePie.map((row) => (
              <div key={row.type} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: row.fill }} />
                  {row.name}
                </span>
                <span className="font-mono">{row.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="glass border-white/10 p-6 lg:col-span-1">
          <div className="font-semibold mb-1">Pipeline status</div>
          <p className="text-xs text-muted-foreground mb-4">Tickets by workflow stage</p>
          <ChartContainer
            config={{ count: { label: "Tickets", color: "oklch(0.72 0.18 230)" } }}
            className="h-[260px] w-full"
          >
            <BarChart data={statusBar} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-white/10" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="status" width={88} tickLine={false} axisLine={false} className="text-[10px]" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="oklch(0.72 0.18 230)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ChartContainer>
        </Card>

        <Card className="glass border-white/10 p-6 lg:col-span-1">
          <div className="font-semibold mb-1">Department load</div>
          <p className="text-xs text-muted-foreground mb-4">Reports touching each department</p>
          <ChartContainer
            config={{ count: { label: "Reports", color: "oklch(0.7 0.2 175)" } }}
            className="h-[260px] w-full"
          >
            <BarChart data={deptBar}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-white/10" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-[10px]" />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="oklch(0.7 0.2 175)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </Card>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="glass border-white/10 p-6 lg:col-span-3">
          <div className="font-semibold mb-1">Report volume</div>
          <p className="text-xs text-muted-foreground mb-4">Submissions over the last 14 days</p>
          <ChartContainer
            config={{ count: { label: "Reports", color: "oklch(0.72 0.18 230)" } }}
            className="h-[220px] w-full"
          >
            <AreaChart data={analytics.timeline}>
              <defs>
                <linearGradient id="fillReports" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.72 0.18 230)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="oklch(0.72 0.18 230)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-white/10" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="count" stroke="oklch(0.72 0.18 230)" fill="url(#fillReports)" strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        </Card>

        <Card className="glass border-white/10 p-6 lg:col-span-2">
          <div className="font-semibold mb-4">Resolution funnel</div>
          <div className="space-y-4">
            {[
              { label: "Auto-routed", value: analytics.autoRoutedCount, max: analytics.stats.totalReports || 1 },
              { label: "Manual review", value: analytics.manualReviewCount, max: analytics.stats.totalReports || 1 },
              { label: "Resolved / closed", value: analytics.stats.resolvedCount, max: analytics.stats.totalReports || 1 },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-mono">{row.value}</span>
                </div>
                <Progress value={(row.value / row.max) * 100} className="h-2" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="glass border-white/10 p-6">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <div className="font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4 text-violet-300" />
              Recent AI diagnoses
            </div>
            <p className="text-xs text-muted-foreground mt-1">Latest classified reports with confidence and routing</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {analytics.diagnosisFeed.map((item) => {
            const Icon = ISSUE_ICONS[item.issueType];
            const meta = ISSUE_META[item.issueType];
            return (
              <Link
                key={item.id}
                to="/reports/$id"
                params={{ id: item.id }}
                className="rounded-xl border border-white/10 bg-white/5 p-4 hover:border-primary/40 hover:bg-white/[0.07] transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${meta.color} opacity-90 grid place-items-center`}>
                      <Icon className="h-4 w-4 text-background" />
                    </div>
                    <div>
                      <div className="font-medium text-sm group-hover:text-primary transition-colors">{item.issueLabel}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{item.id}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                    {item.status.replace("_", " ")}
                  </Badge>
                </div>
                {item.breakdown && (
                  <p className="mt-2 text-[11px] text-violet-200/90 line-clamp-2">{item.breakdown}</p>
                )}
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate pr-2">{item.department}</span>
                  <span className="font-mono text-primary">{item.confidencePct}%</span>
                </div>
                {item.isMultiIssue && (
                  <Badge className="mt-2 bg-violet-500/20 text-violet-100 border-violet-400/30 text-[10px]">
                    Multi-department
                  </Badge>
                )}
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
