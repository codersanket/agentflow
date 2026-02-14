"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useBuilderStore } from "@/stores/builder-store";
import type { TriggerNodeData } from "@/types/builder";

interface TriggerConfigProps {
  nodeId: string;
  data: TriggerNodeData;
}

export function TriggerConfig({ nodeId, data }: TriggerConfigProps) {
  const updateNodeData = useBuilderStore((s) => s.updateNodeData);

  const updateConfig = (updates: Partial<TriggerNodeData["config"]>) => {
    updateNodeData(nodeId, {
      config: { ...data.config, ...updates },
    } as Partial<TriggerNodeData>);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Trigger Type</Label>
        <Badge variant="secondary">{data.subtype}</Badge>
      </div>

      {data.subtype === "webhook" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              value={data.config.webhook_url || ""}
              placeholder="Generated on publish"
              disabled
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payload-schema">Payload Schema (JSON)</Label>
            <Textarea
              id="payload-schema"
              value={data.config.payload_schema || ""}
              onChange={(e) => updateConfig({ payload_schema: e.target.value })}
              placeholder='{"email": "string", "name": "string"}'
              className="font-mono text-xs"
              rows={4}
            />
          </div>
        </>
      )}

      {data.subtype === "schedule" && (
        <div className="space-y-2">
          <Label htmlFor="cron">Cron Expression</Label>
          <Input
            id="cron"
            value={data.config.cron_expression || ""}
            onChange={(e) => updateConfig({ cron_expression: e.target.value })}
            placeholder="0 9 * * 1"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            {describeCron(data.config.cron_expression || "")}
          </p>
        </div>
      )}

      {data.subtype === "manual" && (
        <div className="space-y-2">
          <Label htmlFor="input-schema">Input Schema (JSON)</Label>
          <Textarea
            id="input-schema"
            value={data.config.input_schema || ""}
            onChange={(e) => updateConfig({ input_schema: e.target.value })}
            placeholder='{"query": "string"}'
            className="font-mono text-xs"
            rows={4}
          />
        </div>
      )}
    </div>
  );
}

function describeCron(expr: string): string {
  if (!expr.trim()) return "e.g. 0 9 * * 1 = Every Monday at 9:00 AM";
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return "Invalid cron expression";
  const [min, hour, dom, , dow] = parts;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let desc = "Runs ";
  if (dow !== "*") desc += `on ${days[Number(dow)] || dow} `;
  if (dom !== "*") desc += `on day ${dom} `;
  if (hour !== "*" && min !== "*") desc += `at ${hour}:${min.padStart(2, "0")}`;
  else if (hour !== "*") desc += `at ${hour}:00`;
  else desc += "every hour";
  return desc;
}
