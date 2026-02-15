"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useExecutionStore } from "@/stores/execution-store";
import { useBuilderStore } from "@/stores/builder-store";
import { schemaToFields } from "@/components/builder/schema-builder";

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
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [rawJson, setRawJson] = useState("{\n  \n}");
  const [useRawJson, setUseRawJson] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nodes = useBuilderStore((s) => s.nodes);

  // Find the trigger node and extract its schema fields
  const schemaFields = useMemo(() => {
    const triggerNode = nodes.find((n) => n.data.type === "trigger");
    if (!triggerNode) return [];
    const config = triggerNode.data.config as Record<string, unknown>;
    const schema =
      (config.payload_schema as string) ||
      (config.input_schema as string) ||
      "";
    return schemaToFields(schema);
  }, [nodes]);

  const {
    currentExecution,
    steps,
    isStreaming,
    startStreaming,
    stopStreaming,
    setExecution,
    reset,
  } = useExecutionStore();

  // Preflight check — detect missing integrations/providers
  const [preflightWarnings, setPreflightWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function checkPreflight() {
      const warnings: string[] = [];

      const hasAI = nodes.some((n) => n.data.type === "ai");
      const hasSlack = nodes.some(
        (n) =>
          n.data.type === "action" &&
          ((n.data.config as Record<string, unknown>).action_type === "slack_send_message" ||
            n.data.subtype === "slack")
      );

      try {
        if (hasAI) {
          const res = await api.org.aiProviders.list();
          if (!res.providers.some((p) => p.is_configured)) {
            warnings.push("No AI provider configured — AI nodes will fail");
          }
        }
        if (hasSlack) {
          const integrations = await api.integrations.list();
          if (!integrations.some((i) => i.provider === "slack" && i.status === "connected")) {
            warnings.push("Slack not connected — Slack actions will fail");
          }
        }
      } catch {
        // Ignore errors in preflight
      }

      if (!cancelled) setPreflightWarnings(warnings);
    }

    checkPreflight();
    return () => { cancelled = true; };
  }, [open, nodes]);

  const isRunning = currentExecution?.status === "running" || isStreaming;
  const isComplete =
    currentExecution?.status === "completed" ||
    currentExecution?.status === "failed";

  useEffect(() => {
    if (!open) {
      stopStreaming();
      reset();
      setFormValues({});
      setRawJson("{\n  \n}");
      setJsonError(null);
      setError(null);
      setIsStarting(false);
      setUseRawJson(false);
    }
  }, [open, stopStreaming, reset]);

  const buildTriggerData = useCallback((): Record<string, unknown> | null => {
    if (useRawJson || schemaFields.length === 0) {
      try {
        return JSON.parse(rawJson);
      } catch {
        setJsonError("Invalid JSON. Please check your input.");
        return null;
      }
    }
    // Convert form values to proper types based on schema
    const data: Record<string, unknown> = {};
    for (const field of schemaFields) {
      const val = formValues[field.name] ?? "";
      if (!val && field.type !== "boolean") continue;
      switch (field.type) {
        case "number":
          data[field.name] = Number(val) || 0;
          break;
        case "boolean":
          data[field.name] = val === "true" || val === "1";
          break;
        default:
          data[field.name] = val;
      }
    }
    return data;
  }, [useRawJson, rawJson, schemaFields, formValues]);

  const handleRunTest = useCallback(async () => {
    setJsonError(null);
    setError(null);

    const parsed = buildTriggerData();
    if (!parsed) return;

    setIsStarting(true);
    reset();

    try {
      const execution = await api.agents.test(agentId, {
        trigger_data: parsed,
      });
      setExecution({
        id: execution.id,
        agent_id: execution.agent_id,
        status: execution.status as
          | "pending"
          | "running"
          | "completed"
          | "failed"
          | "cancelled",
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
  }, [agentId, buildTriggerData, reset, setExecution, startStreaming]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Test Run</DialogTitle>
          <DialogDescription>
            Test your agent with sample data to see how it works.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto">
          {preflightWarnings.length > 0 && !currentExecution && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/50">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
                  {preflightWarnings.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!currentExecution && (
            <div className="space-y-3">
              {/* Form-based input when schema is available */}
              {schemaFields.length > 0 && !useRawJson && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Test Data</Label>
                  {schemaFields.map((field) => (
                    <div key={field.name} className="space-y-1">
                      <Label
                        htmlFor={`test-${field.name}`}
                        className="text-xs capitalize"
                      >
                        {field.name.replace(/_/g, " ")}
                        <span className="ml-1 font-normal text-muted-foreground">
                          ({field.type === "string" ? "text" : field.type})
                        </span>
                      </Label>
                      {field.type === "object" || field.type === "array" ? (
                        <Textarea
                          id={`test-${field.name}`}
                          value={formValues[field.name] ?? ""}
                          onChange={(e) =>
                            setFormValues((prev) => ({
                              ...prev,
                              [field.name]: e.target.value,
                            }))
                          }
                          placeholder={`Enter ${field.name}...`}
                          className="font-mono text-xs"
                          rows={3}
                        />
                      ) : (
                        <Input
                          id={`test-${field.name}`}
                          type={
                            field.type === "number"
                              ? "number"
                              : field.type === "email"
                              ? "email"
                              : field.type === "url"
                              ? "url"
                              : "text"
                          }
                          value={formValues[field.name] ?? ""}
                          onChange={(e) =>
                            setFormValues((prev) => ({
                              ...prev,
                              [field.name]: e.target.value,
                            }))
                          }
                          placeholder={`Enter ${field.name.replace(/_/g, " ")}...`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Raw JSON fallback */}
              {(schemaFields.length === 0 || useRawJson) && (
                <div className="space-y-2">
                  <Label htmlFor="trigger-data">Trigger Data (JSON)</Label>
                  <Textarea
                    id="trigger-data"
                    value={rawJson}
                    onChange={(e) => {
                      setRawJson(e.target.value);
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

              {/* Toggle between form and raw JSON */}
              {schemaFields.length > 0 && (
                <button
                  type="button"
                  onClick={() => setUseRawJson(!useRawJson)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {useRawJson
                    ? "Switch to form view"
                    : "Switch to raw JSON"}
                </button>
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
                      ${Number(currentExecution.total_cost).toFixed(4)}
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

function ExecutionStatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
    }
  > = {
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
              {formatDuration(step.duration_ms)}
            </span>
          )}
          {step.tokens_used > 0 && (
            <span>{step.tokens_used} tokens</span>
          )}
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t p-3 text-xs space-y-2">
          {step.output_data && <OutputViewer data={step.output_data} />}
          {step.error_message && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2">
              <p className="text-destructive">{step.error_message}</p>
            </div>
          )}
          {!step.output_data && !step.error_message && (
            <p className="text-muted-foreground">No output data</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Render output data as formatted key-value pairs instead of raw JSON */
function OutputViewer({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <p className="text-muted-foreground">Empty output</p>;
  }

  return (
    <div className="space-y-1.5">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded bg-muted px-2.5 py-1.5">
          <span className="font-medium text-muted-foreground">{key}: </span>
          <span className="break-all">
            {typeof value === "string"
              ? value
              : JSON.stringify(value, null, 2)}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
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
      return (
        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
      );
  }
}
