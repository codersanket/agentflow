"use client";

import { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineStep {
  id: string;
  node_name: string;
  status: "pending" | "running" | "completed" | "failed" | "waiting_approval";
  duration_ms: number;
  tokens_used: number;
  input_data?: Record<string, unknown>;
  output_data?: Record<string, unknown>;
  error_message?: string;
}

interface ExecutionTimelineProps {
  steps: TimelineStep[];
}

const statusStyles: Record<string, { color: string; bgColor: string }> = {
  running: { color: "text-blue-500", bgColor: "bg-blue-500" },
  completed: { color: "text-green-500", bgColor: "bg-green-500" },
  failed: { color: "text-red-500", bgColor: "bg-red-500" },
  waiting_approval: { color: "text-yellow-500", bgColor: "bg-yellow-500" },
  pending: { color: "text-muted-foreground", bgColor: "bg-muted-foreground/30" },
};

export function ExecutionTimeline({ steps }: ExecutionTimelineProps) {
  if (steps.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No execution steps to display.
      </p>
    );
  }

  return (
    <div className="relative space-y-0">
      {steps.map((step, index) => (
        <TimelineItem
          key={step.id}
          step={step}
          isLast={index === steps.length - 1}
        />
      ))}
    </div>
  );
}

function TimelineItem({
  step,
  isLast,
}: {
  step: TimelineStep;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const style = statusStyles[step.status] || statusStyles.pending;

  return (
    <div className="relative flex gap-3">
      <div className="flex flex-col items-center">
        <div className="relative z-10 flex h-6 w-6 items-center justify-center">
          <StepIcon status={step.status} />
        </div>
        {!isLast && (
          <div className={cn("w-0.5 flex-1 min-h-[24px]", style.bgColor)} />
        )}
      </div>

      <div className="flex-1 pb-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between rounded-md p-2 text-left hover:bg-accent/50 transition-colors -ml-2"
        >
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">{step.node_name}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {step.duration_ms > 0 && <span>{step.duration_ms}ms</span>}
            {step.tokens_used > 0 && <span>{step.tokens_used} tokens</span>}
          </div>
        </button>

        {expanded && (
          <div className="mt-1 ml-3 space-y-2 text-xs">
            {step.input_data && Object.keys(step.input_data).length > 0 && (
              <div>
                <p className="font-medium text-muted-foreground mb-1">Input</p>
                <pre className="overflow-auto rounded bg-muted p-2 font-mono">
                  {JSON.stringify(step.input_data, null, 2)}
                </pre>
              </div>
            )}
            {step.output_data && Object.keys(step.output_data).length > 0 && (
              <div>
                <p className="font-medium text-muted-foreground mb-1">Output</p>
                <pre className="overflow-auto rounded bg-muted p-2 font-mono">
                  {JSON.stringify(step.output_data, null, 2)}
                </pre>
              </div>
            )}
            {step.error_message && (
              <div>
                <p className="font-medium text-destructive mb-1">Error</p>
                <p className="text-destructive">{step.error_message}</p>
              </div>
            )}
            {!step.input_data && !step.output_data && !step.error_message && (
              <p className="text-muted-foreground">No data available</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StepIcon({ status }: { status: string }) {
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
        <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/30" />
      );
  }
}
