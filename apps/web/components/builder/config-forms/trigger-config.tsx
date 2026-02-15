"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Copy, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBuilderStore } from "@/stores/builder-store";
import { SchemaBuilder } from "@/components/builder/schema-builder";
import type { TriggerNodeData } from "@/types/builder";

interface TriggerConfigProps {
  nodeId: string;
  data: TriggerNodeData;
}

// ─── Schedule Presets ─────────────────────────────────────────────

const SCHEDULE_PRESETS = [
  { value: "custom", label: "Custom", cron: "" },
  { value: "every_5m", label: "Every 5 minutes", cron: "*/5 * * * *" },
  { value: "every_15m", label: "Every 15 minutes", cron: "*/15 * * * *" },
  { value: "hourly", label: "Every hour", cron: "0 * * * *" },
  { value: "daily_9am", label: "Daily at 9:00 AM", cron: "0 9 * * *" },
  { value: "daily_6pm", label: "Daily at 6:00 PM", cron: "0 18 * * *" },
  { value: "weekdays_9am", label: "Weekdays at 9:00 AM", cron: "0 9 * * 1-5" },
  { value: "weekly_mon", label: "Weekly on Monday", cron: "0 9 * * 1" },
  { value: "monthly", label: "Monthly on the 1st", cron: "0 9 1 * *" },
];

function matchPreset(cron: string): string {
  const match = SCHEDULE_PRESETS.find((p) => p.cron === cron);
  return match ? match.value : "custom";
}

export function TriggerConfig({ nodeId, data }: TriggerConfigProps) {
  const updateNodeData = useBuilderStore((s) => s.updateNodeData);
  const { id: agentId } = useParams();
  const [copied, setCopied] = useState(false);

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const webhookUrl = `${apiUrl}/webhooks/${agentId}`;

  const updateConfig = (updates: Partial<TriggerNodeData["config"]>) => {
    updateNodeData(nodeId, {
      config: { ...data.config, ...updates },
    } as Partial<TriggerNodeData>);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Trigger Type</Label>
        <Badge variant="secondary" className="capitalize">
          {data.subtype}
        </Badge>
      </div>

      {data.subtype === "webhook" && (
        <>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Send a POST request to this URL to trigger your agent. The agent
              must be published and active.
            </p>
          </div>

          <div className="rounded-md border bg-muted/50 p-3">
            <p className="text-xs font-medium mb-1">Example</p>
            <code className="text-[11px] text-muted-foreground break-all">
              curl -X POST {webhookUrl} -H &quot;Content-Type:
              application/json&quot; -d &apos;{"{"}...{"}"}&apos;
            </code>
          </div>

          <div className="space-y-2">
            <Label>Expected Data Fields</Label>
            <p className="text-xs text-muted-foreground">
              Define the fields your webhook will receive. These become available as variables in later steps.
            </p>
            <SchemaBuilder
              value={data.config.payload_schema || ""}
              onChange={(v) => updateConfig({ payload_schema: v })}
            />
          </div>
        </>
      )}

      {data.subtype === "schedule" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Run Schedule</Label>
            <Select
              value={matchPreset(data.config.cron_expression || "")}
              onValueChange={(v) => {
                const preset = SCHEDULE_PRESETS.find((p) => p.value === v);
                if (preset && v !== "custom") {
                  updateConfig({ cron_expression: preset.cron });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a schedule..." />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {matchPreset(data.config.cron_expression || "") === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="cron">Cron Expression</Label>
              <Input
                id="cron"
                value={data.config.cron_expression || ""}
                onChange={(e) =>
                  updateConfig({ cron_expression: e.target.value })
                }
                placeholder="0 9 * * 1"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Format: minute hour day month weekday
                <br />
                Example: <code className="bg-muted px-1 rounded">0 9 * * 1</code> = Every Monday at 9:00 AM
              </p>
            </div>
          )}

          <div className="rounded-md border bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {describeCron(data.config.cron_expression || "")}
            </p>
          </div>
        </div>
      )}

      {data.subtype === "manual" && (
        <div className="space-y-2">
          <Label>Input Fields</Label>
          <p className="text-xs text-muted-foreground">
            Define what information the user provides when they start this agent manually.
          </p>
          <SchemaBuilder
            value={data.config.input_schema || ""}
            onChange={(v) => updateConfig({ input_schema: v })}
          />
        </div>
      )}
    </div>
  );
}

function describeCron(expr: string): string {
  if (!expr.trim()) return "No schedule set yet. Choose a schedule above.";
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return "Invalid schedule expression.";
  const [min, hour, dom, , dow] = parts;
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  let desc = "Runs ";
  if (dow === "1-5") return `Runs on weekdays at ${hour}:${min.padStart(2, "0")}`;
  if (dow !== "*") desc += `every ${days[Number(dow)] || dow} `;
  if (dom !== "*") desc += `on day ${dom} of the month `;
  if (min.startsWith("*/"))
    return `Runs every ${min.slice(2)} minutes`;
  if (hour !== "*" && min !== "*")
    desc += `at ${hour}:${min.padStart(2, "0")}`;
  else if (hour !== "*") desc += `at ${hour}:00`;
  else desc += "every hour";
  return desc;
}
