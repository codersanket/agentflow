"use client";

import { type ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBuilderStore } from "@/stores/builder-store";
import { useExecutionStore } from "@/stores/execution-store";
import type { AgentNodeData, NodeCategory } from "@/types/builder";

const categoryColors: Record<NodeCategory, string> = {
  trigger: "border-emerald-500/50 bg-emerald-500/5",
  ai: "border-violet-500/50 bg-violet-500/5",
  action: "border-blue-500/50 bg-blue-500/5",
  logic: "border-amber-500/50 bg-amber-500/5",
  human: "border-rose-500/50 bg-rose-500/5",
};

const categoryHeaderColors: Record<NodeCategory, string> = {
  trigger: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  ai: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  action: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  logic: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  human: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

const executionStatusClasses: Record<string, string> = {
  running: "ring-2 ring-blue-500 animate-pulse shadow-lg shadow-blue-500/25",
  completed: "ring-2 ring-green-500 shadow-lg shadow-green-500/25",
  failed: "ring-2 ring-red-500 shadow-lg shadow-red-500/25",
  waiting_approval: "ring-2 ring-yellow-500 animate-pulse shadow-lg shadow-yellow-500/25",
};

interface BaseNodeProps {
  id: string;
  data: AgentNodeData;
  selected?: boolean;
  icon: ReactNode;
  children?: ReactNode;
  showInput?: boolean;
  showOutput?: boolean;
  outputHandles?: { id: string; label: string }[];
}

export function BaseNode({
  id,
  data,
  selected,
  icon,
  children,
  showInput = true,
  showOutput = true,
  outputHandles,
}: BaseNodeProps) {
  const removeNode = useBuilderStore((s) => s.removeNode);
  const executionStatus = useExecutionStore((s) => s.nodeStatusMap[id]);
  const category = data.type;

  return (
    <div
      className={cn(
        "group relative w-[220px] rounded-lg border-2 bg-card shadow-sm transition-shadow",
        categoryColors[category],
        selected && !executionStatus && "ring-2 ring-primary shadow-md",
        executionStatus && executionStatusClasses[executionStatus]
      )}
    >
      {executionStatus && (
        <div className="absolute -top-1 -right-1 z-10">
          {executionStatus === "running" && (
            <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
          )}
          {executionStatus === "completed" && (
            <div className="h-3 w-3 rounded-full bg-green-500 flex items-center justify-center">
              <svg className="h-2 w-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {executionStatus === "failed" && (
            <div className="h-3 w-3 rounded-full bg-red-500 flex items-center justify-center">
              <svg className="h-2 w-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
          {executionStatus === "waiting_approval" && (
            <div className="h-3 w-3 rounded-full bg-yellow-500 animate-pulse" />
          )}
        </div>
      )}
      {showInput && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3 !w-3 !border-2 !border-background !bg-muted-foreground"
        />
      )}

      <div
        className={cn(
          "flex items-center gap-2 rounded-t-md px-3 py-2 text-xs font-medium",
          categoryHeaderColors[category]
        )}
      >
        {icon}
        <span className="flex-1 truncate">{data.label}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeNode(id);
          }}
          className="hidden rounded p-0.5 hover:bg-black/10 group-hover:block"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {children && <div className="px-3 py-2 text-xs text-muted-foreground">{children}</div>}

      {outputHandles ? (
        <div className="relative pb-4">
          {outputHandles.map((handle, i) => (
            <Handle
              key={handle.id}
              type="source"
              position={Position.Bottom}
              id={handle.id}
              className="!h-3 !w-3 !border-2 !border-background !bg-muted-foreground"
              style={{
                left: `${((i + 1) / (outputHandles.length + 1)) * 100}%`,
              }}
            />
          ))}
          <div className="flex justify-around px-2 text-[10px] text-muted-foreground">
            {outputHandles.map((handle) => (
              <span key={handle.id}>{handle.label}</span>
            ))}
          </div>
        </div>
      ) : (
        showOutput && (
          <Handle
            type="source"
            position={Position.Bottom}
            className="!h-3 !w-3 !border-2 !border-background !bg-muted-foreground"
          />
        )
      )}
    </div>
  );
}
