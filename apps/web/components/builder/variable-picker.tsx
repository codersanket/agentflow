"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBuilderStore } from "@/stores/builder-store";

interface VariablePickerProps {
  nodeId: string;
  onInsert: (variable: string) => void;
}

export function VariablePicker({ nodeId, onInsert }: VariablePickerProps) {
  const [open, setOpen] = useState(false);
  const nodes = useBuilderStore((s) => s.nodes);
  const edges = useBuilderStore((s) => s.edges);

  const upstreamNodeIds = getUpstreamNodeIds(nodeId, edges);
  const upstreamNodes = nodes.filter((n) => upstreamNodeIds.has(n.id));

  if (upstreamNodes.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
      >
        Insert Variable <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-64 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {upstreamNodes.map((node) => (
            <div key={node.id}>
              <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase">
                {node.data.label}
              </p>
              <button
                onClick={() => {
                  onInsert(`{{${node.id}.output.text}}`);
                  setOpen(false);
                }}
                className="flex w-full rounded-sm px-2 py-1.5 text-xs hover:bg-accent"
              >
                <code className="text-[10px]">{`{{${node.id}.output.text}}`}</code>
              </button>
              <button
                onClick={() => {
                  onInsert(`{{${node.id}.output}}`);
                  setOpen(false);
                }}
                className="flex w-full rounded-sm px-2 py-1.5 text-xs hover:bg-accent"
              >
                <code className="text-[10px]">{`{{${node.id}.output}}`}</code>
              </button>
            </div>
          ))}

          <div>
            <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase">
              Trigger
            </p>
            <button
              onClick={() => {
                onInsert("{{trigger.data}}");
                setOpen(false);
              }}
              className="flex w-full rounded-sm px-2 py-1.5 text-xs hover:bg-accent"
            >
              <code className="text-[10px]">{"{{trigger.data}}"}</code>
            </button>
          </div>
        </div>
      )}
    </div>
  );
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
