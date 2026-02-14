"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBuilderStore } from "@/stores/builder-store";
import type { HumanNodeData } from "@/types/builder";

interface HumanConfigProps {
  nodeId: string;
  data: HumanNodeData;
}

export function HumanConfig({ nodeId, data }: HumanConfigProps) {
  const updateNodeData = useBuilderStore((s) => s.updateNodeData);

  const updateConfig = (updates: Partial<HumanNodeData["config"]>) => {
    updateNodeData(nodeId, {
      config: { ...data.config, ...updates },
    } as Partial<HumanNodeData>);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="approval-message">Approval Message</Label>
        <Textarea
          id="approval-message"
          value={data.config.message}
          onChange={(e) => updateConfig({ message: e.target.value })}
          placeholder="Please review and approve this action..."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="approvers">Approvers</Label>
        <Input
          id="approvers"
          value={data.config.approvers?.join(", ") || ""}
          onChange={(e) =>
            updateConfig({
              approvers: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="user@example.com, admin@example.com"
        />
        <p className="text-xs text-muted-foreground">Comma-separated email addresses</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="timeout">Timeout (minutes)</Label>
        <Input
          id="timeout"
          type="number"
          value={data.config.timeout_minutes || 60}
          onChange={(e) => updateConfig({ timeout_minutes: parseInt(e.target.value) || 60 })}
          min={1}
          max={10080}
        />
      </div>
    </div>
  );
}
