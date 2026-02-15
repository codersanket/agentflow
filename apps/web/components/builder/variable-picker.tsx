"use client";

import { useState } from "react";
import { ChevronDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBuilderStore } from "@/stores/builder-store";

interface VariablePickerProps {
  nodeId: string;
  onInsert: (variable: string) => void;
}

/**
 * A dropdown that shows upstream nodes and lets users insert variable
 * references using friendly node labels instead of raw UUIDs.
 */
export function VariablePicker({ nodeId, onInsert }: VariablePickerProps) {
  const [open, setOpen] = useState(false);
  const nodes = useBuilderStore((s) => s.nodes);
  const edges = useBuilderStore((s) => s.edges);

  const upstreamNodeIds = getUpstreamNodeIds(nodeId, edges);
  const upstreamNodes = nodes.filter((n) => upstreamNodeIds.has(n.id));

  // Check if there's a trigger node in the flow
  const triggerNode = nodes.find((n) => n.data.type === "trigger");

  if (upstreamNodes.length === 0 && !triggerNode) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <Zap className="h-3 w-3" />
        Insert Variable
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-72 overflow-y-auto rounded-lg border bg-popover p-1.5 shadow-lg">
          <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground">
            Click to insert data from a previous step
          </p>

          {triggerNode && (
            <div className="mt-1">
              <p className="px-2 py-1 text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
                Trigger Data
              </p>
              <VarButton
                label="All trigger data"
                code="{{trigger.data}}"
                onClick={() => {
                  onInsert("{{trigger.data}}");
                  setOpen(false);
                }}
              />
            </div>
          )}

          {upstreamNodes.map((node) => {
            const varName = toVarName(node.data.label);
            return (
              <div key={node.id} className="mt-1">
                <p className="px-2 py-1 text-[10px] font-semibold text-violet-600 uppercase tracking-wider">
                  {node.data.label}
                </p>
                <VarButton
                  label={`Full output from ${node.data.label}`}
                  code={`{{${varName}.output}}`}
                  onClick={() => {
                    onInsert(`{{${varName}.output}}`);
                    setOpen(false);
                  }}
                />
                <VarButton
                  label={`Text result from ${node.data.label}`}
                  code={`{{${varName}.output.text}}`}
                  onClick={() => {
                    onInsert(`{{${varName}.output.text}}`);
                    setOpen(false);
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VarButton({
  label,
  code,
  onClick,
}: {
  label: string;
  code: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-accent transition-colors"
    >
      <span className="text-xs">{label}</span>
      <code className="text-[10px] font-mono text-muted-foreground">
        {code}
      </code>
    </button>
  );
}

function toVarName(label: string): string {
  return label.replace(/\s+/g, "_").toLowerCase();
}

function getUpstreamNodeIds(
  nodeId: string,
  edges: { source: string; target: string }[]
): Set<string> {
  const upstream = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const edge of edges) {
      if (edge.target === current && !upstream.has(edge.source)) {
        upstream.add(edge.source);
        queue.push(edge.source);
      }
    }
  }
  return upstream;
}
