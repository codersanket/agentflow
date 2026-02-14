"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useExecutionStore } from "@/stores/execution-store";

interface TestRunDialogProps {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TestRunDialog({
  agentId,
  open,
  onOpenChange,
}: TestRunDialogProps) {
  const [triggerData, setTriggerData] = useState("{\n  \n}");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    currentExecution,
    steps,
    isStreaming,
    startStreaming,
    stopStreaming,
    setExecution,
    reset,
  } = useExecutionStore();

  const isRunning = currentExecution?.status === "running" || isStreaming;
  const isComplete =
    currentExecution?.status === "completed" ||
    currentExecution?.status === "failed";

  useEffect(() => {
    if (!open) {
      stopStreaming();
      reset();
      setTriggerData("{\n  \n}");
      setJsonError(null);
      setError(null);
      setIsStarting(false);
    }
  }, [open, stopStreaming, reset]);

  const handleRunTest = useCallback(async () => {
    setJsonError(null);
    setError(null);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(triggerData);
    } catch {
      setJsonError("Invalid JSON. Please check your input.");
      return;
    }

    setIsStarting(true);
    reset();

    try {
      const execution = await api.agents.test(agentId, {
        trigger_data: parsed,
      });
      setExecution({
        id: execution.id,
        agent_id: execution.agent_id,
        status: execution.status as "pending" | "running" | "completed" | "failed" | "cancelled",
        triggered_by: execution.triggered_by || "test",
        trigger_data: parsed,
        total_tokens: 0,
        total_cost: 0,
        started_at: execution.started_at,
      });
      startStreaming(execution.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start test");
    } finally {
      setIsStarting(false);
    }
  }, [agentId, triggerData, reset, setExecution, startStreaming]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Test Run</DialogTitle>
          <DialogDescription>
            Test your agent with sample trigger data.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto">
          {!currentExecution && (
            <div className="space-y-2">
              <Label htmlFor="trigger-data">Trigger Data (JSON)</Label>
              <Textarea
                id="trigger-data"
                value={triggerData}
                onChange={(e) => {
                  setTriggerData(e.target.value);
                  setJsonError(null);
                }}
                className="font-mono text-sm min-h-[120px]"
                placeholder='{"key": "value"}'
              />
              {jsonError && (
                <p className="text-sm text-destructive">{jsonError}</p>
              )}
            </div>
          )}

          {currentExecution && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  <ExecutionStatusBadge status={currentExecution.status} />
                </div>
                {isComplete && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      {currentExecution.total_tokens} tokens
                    </span>
                    <span className="flex items-center gap-1">
                      ${currentExecution.total_cost.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {steps.map((step) => (
                  <StepResult key={step.id} step={step} />
                ))}
                {isStreaming && steps.length === 0 && (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Waiting for execution to start...
                  </div>
                )}
              </div>

              {currentExecution.error_message && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">
                    {currentExecution.error_message}
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!isComplete && (
            <Button
              onClick={handleRunTest}
              disabled={isStarting || isRunning}
            >
              {isStarting || isRunning ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {isRunning ? "Running..." : "Run Test"}
            </Button>
          )}
          {isComplete && (
            <Button
              onClick={() => {
                reset();
                setError(null);
              }}
            >
              Run Again
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExecutionStatusBadge({
  status,
}: {
  status: string;
}) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pending", variant: "outline" },
    running: { label: "Running", variant: "default" },
    completed: { label: "Completed", variant: "secondary" },
    failed: { label: "Failed", variant: "destructive" },
    cancelled: { label: "Cancelled", variant: "outline" },
  };
  const c = config[status] || { label: status, variant: "outline" as const };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function StepResult({
  step,
}: {
  step: {
    id: string;
    node_name: string;
    status: string;
    duration_ms: number;
    tokens_used: number;
    output_data?: Record<string, unknown>;
    error_message?: string;
  };
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-3 text-left hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <StepStatusIcon status={step.status} />
          <span className="text-sm font-medium">{step.node_name}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {step.duration_ms > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {step.duration_ms}ms
            </span>
          )}
          {step.tokens_used > 0 && (
            <span>{step.tokens_used} tokens</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t p-3 text-xs">
          {step.output_data && (
            <pre className="overflow-auto rounded bg-muted p-2 font-mono">
              {JSON.stringify(step.output_data, null, 2)}
            </pre>
          )}
          {step.error_message && (
            <p className="text-destructive">{step.error_message}</p>
          )}
          {!step.output_data && !step.error_message && (
            <p className="text-muted-foreground">No output data</p>
          )}
        </div>
      )}
    </div>
  );
}

function StepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "waiting_approval":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    default:
      return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
  }
}
