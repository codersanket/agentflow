"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  ExecutionTimeline,
  type TimelineStep,
} from "@/components/executions/execution-timeline";
import { api, type Execution } from "@/lib/api";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function ExecutionsPage() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [steps, setSteps] = useState<TimelineStep[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchExecutions = useCallback(async () => {
    try {
      const params: Record<string, string> = { limit: "50" };
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await api.executions.list(params);
      setExecutions(res.items);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setIsLoading(true);
    fetchExecutions();
  }, [fetchExecutions]);

  // Auto-refresh when there are running executions
  useEffect(() => {
    const hasRunning = executions.some((e) => e.status === "running" || e.status === "pending");
    if (!hasRunning) return;

    const interval = setInterval(fetchExecutions, 5000);
    return () => clearInterval(interval);
  }, [executions, fetchExecutions]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchExecutions();
  };

  const handleExpand = async (executionId: string) => {
    if (expandedId === executionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(executionId);
    try {
      const data = await api.executions.steps(executionId);
      setSteps(
        data.map((s) => ({
          id: s.id,
          node_name: s.node_id || `Step ${s.step_order}`,
          status: s.status as TimelineStep["status"],
          duration_ms: s.duration_ms,
          tokens_used: s.tokens_used,
          input_data: s.input_data,
          output_data: s.output_data,
          error_message: s.error_message,
        }))
      );
    } catch {
      setSteps([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Executions</h2>
          <p className="text-muted-foreground">
            View and monitor agent execution history.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : executions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
          <Play className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No executions yet</h3>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            Executions will appear here once you run an agent.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Triggered By</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.map((exec) => (
                <>
                  <TableRow
                    key={exec.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => handleExpand(exec.id)}
                  >
                    <TableCell>
                      <ExecutionStatusBadge status={exec.status} />
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {exec.agent_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-sm">{exec.triggered_by}</TableCell>
                    <TableCell className="text-sm">
                      {exec.started_at
                        ? formatRelativeTime(exec.started_at)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {exec.started_at && exec.completed_at
                        ? formatDuration(
                            new Date(exec.completed_at).getTime() -
                              new Date(exec.started_at).getTime()
                          )
                        : exec.status === "running"
                        ? "..."
                        : "-"}
                    </TableCell>
                    <TableCell className="text-sm">{exec.total_tokens}</TableCell>
                    <TableCell className="text-sm">
                      ${Number(exec.total_cost).toFixed(4)}
                    </TableCell>
                  </TableRow>
                  {expandedId === exec.id && (
                    <TableRow key={`${exec.id}-detail`}>
                      <TableCell colSpan={7} className="p-4 bg-muted/30">
                        <ExecutionTimeline steps={steps} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ExecutionStatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
  > = {
    pending: { label: "Pending", variant: "outline" },
    running: { label: "Running", variant: "default" },
    completed: { label: "Completed", variant: "secondary" },
    failed: { label: "Failed", variant: "destructive" },
    cancelled: { label: "Cancelled", variant: "outline" },
  };
  const c = config[status] || { label: status, variant: "outline" as const };
  return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
}
