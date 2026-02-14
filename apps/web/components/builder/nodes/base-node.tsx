"use client";

import { type ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBuilderStore } from "@/stores/builder-store";
import type { AgentNodeData, NodeCategory } from "@/types/builder";

const categoryColors: Record<NodeCategory, string> = {
  trigger: "border-emerald-500/50 bg-emerald-500/5",
  ai: "border-violet-500/50 bg-violet-500/5",
  action: "border-blue-500/50 bg-blue-500/5",
  logic: "border-amber-500/50 bg-amber-500/5",
  human: "border-rose-500/50 bg-rose-500/5",
};

const categoryHeaderColors: Record<NodeCategory, string> = {
  trigger: "bg-emerald-500/10 text-emerald-700",
  ai: "bg-violet-500/10 text-violet-700",
  action: "bg-blue-500/10 text-blue-700",
  logic: "bg-amber-500/10 text-amber-700",
  human: "bg-rose-500/10 text-rose-700",
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
  const category = data.type;

  return (
    <div
      className={cn(
        "group relative w-[220px] rounded-lg border-2 bg-card shadow-sm transition-shadow",
        categoryColors[category],
        selected && "ring-2 ring-primary shadow-md"
      )}
    >
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
