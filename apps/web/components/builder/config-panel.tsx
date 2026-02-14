"use client";

import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBuilderStore } from "@/stores/builder-store";
import { TriggerConfig } from "./config-forms/trigger-config";
import { AIConfig } from "./config-forms/ai-config";
import { ActionConfig } from "./config-forms/action-config";
import { LogicConfig } from "./config-forms/logic-config";
import { HumanConfig } from "./config-forms/human-config";
import type { AgentNodeData } from "@/types/builder";

export function ConfigPanel() {
  const selectedNodeId = useBuilderStore((s) => s.selectedNodeId);
  const nodes = useBuilderStore((s) => s.nodes);
  const selectNode = useBuilderStore((s) => s.selectNode);
  const updateNodeData = useBuilderStore((s) => s.updateNodeData);

  if (!selectedNodeId) return null;

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  const data = node.data as AgentNodeData;

  return (
    <div className="flex h-full w-80 flex-col border-l bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Configure Node</h3>
        <button
          onClick={() => selectNode(null)}
          className="rounded p-1 hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="node-label">Label</Label>
          <Input
            id="node-label"
            value={data.label}
            onChange={(e) =>
              updateNodeData(selectedNodeId, { label: e.target.value } as Partial<AgentNodeData>)
            }
          />
        </div>

        <div className="border-t pt-4">
          <ConfigForm nodeId={selectedNodeId} data={data} />
        </div>
      </div>
    </div>
  );
}

function ConfigForm({ nodeId, data }: { nodeId: string; data: AgentNodeData }) {
  switch (data.type) {
    case "trigger":
      return <TriggerConfig nodeId={nodeId} data={data} />;
    case "ai":
      return <AIConfig nodeId={nodeId} data={data} />;
    case "action":
      return <ActionConfig nodeId={nodeId} data={data} />;
    case "logic":
      return <LogicConfig nodeId={nodeId} data={data} />;
    case "human":
      return <HumanConfig nodeId={nodeId} data={data} />;
    default:
      return <p className="text-sm text-muted-foreground">No configuration available.</p>;
  }
}
