"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  DollarSign,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCard } from "@/components/analytics/stats-card";
import { UsageChart } from "@/components/analytics/usage-chart";
import { CostTable } from "@/components/analytics/cost-table";
import { api } from "@/lib/api";
import type { AnalyticsOverview, UsageDataPoint, CostBreakdownItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type DateRange = "7d" | "30d" | "90d";

function getDateRange(range: DateRange): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  switch (range) {
    case "7d":
      from.setDate(from.getDate() - 7);
      break;
    case "30d":
      from.setDate(from.getDate() - 30);
      break;
    case "90d":
      from.setDate(from.getDate() - 90);
      break;
  }
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)}m`;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [usage, setUsage] = useState<UsageDataPoint[]>([]);
  const [costs, setCosts] = useState<CostBreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(dateRange);

      const [overviewData, usageData, costData] = await Promise.all([
        api.analytics.overview(),
        api.analytics.usage({ from, to, period: "daily" }),
        api.analytics.costs({ group_by: "agent" }),
      ]);

      setOverview(overviewData);
      setUsage(usageData);
      setCosts(costData);
    } catch {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">
            Monitor usage, costs, and performance metrics.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">
            Monitor usage, costs, and performance metrics.
          </p>
        </div>
        <div className="flex gap-1">
          {(["7d", "30d", "90d"] as DateRange[]).map((range) => (
            <Button
              key={range}
              variant={dateRange === range ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange(range)}
              className={cn("text-xs", dateRange === range && "pointer-events-none")}
            >
              {range === "7d" ? "7 days" : range === "30d" ? "30 days" : "90 days"}
            </Button>
          ))}
        </div>
      </div>

      {overview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Executions"
            value={overview.total_executions.toLocaleString()}
            subtitle={`${overview.recent_executions} in last 7 days`}
            icon={<Zap className="h-4 w-4" />}
          />
          <StatsCard
            title="Success Rate"
            value={`${overview.success_rate}%`}
            trend={overview.success_rate >= 90 ? "up" : overview.success_rate >= 70 ? "flat" : "down"}
            trendValue={overview.success_rate >= 90 ? "Good" : "Needs attention"}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <StatsCard
            title="Avg Duration"
            value={formatDuration(overview.avg_duration_ms)}
            icon={<Clock className="h-4 w-4" />}
          />
          <StatsCard
            title="Active Agents"
            value={overview.active_agents}
            subtitle="Last 7 days"
            icon={<Activity className="h-4 w-4" />}
          />
        </div>
      )}

      <UsageChart data={usage} />

      <CostTable data={costs} />
    </div>
  );
}
