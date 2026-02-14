"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBuilderStore } from "@/stores/builder-store";
import type { ActionNodeData } from "@/types/builder";

interface ActionConfigProps {
  nodeId: string;
  data: ActionNodeData;
}

const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export function ActionConfig({ nodeId, data }: ActionConfigProps) {
  const updateNodeData = useBuilderStore((s) => s.updateNodeData);

  const updateConfig = (updates: Partial<ActionNodeData["config"]>) => {
    updateNodeData(nodeId, {
      config: { ...data.config, ...updates },
    } as Partial<ActionNodeData>);
  };

  return (
    <div className="space-y-4">
      {(data.subtype === "http" || data.subtype === "webhook_out") && (
        <>
          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              value={data.config.url || ""}
              onChange={(e) => updateConfig({ url: e.target.value })}
              placeholder="https://api.example.com/endpoint"
            />
          </div>

          <div className="space-y-2">
            <Label>Method</Label>
            <Select
              value={data.config.method || "POST"}
              onValueChange={(v) => updateConfig({ method: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {httpMethods.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="headers">Headers (JSON)</Label>
            <Textarea
              id="headers"
              value={
                typeof data.config.headers === "object"
                  ? JSON.stringify(data.config.headers, null, 2)
                  : ""
              }
              onChange={(e) => {
                try {
                  updateConfig({ headers: JSON.parse(e.target.value) });
                } catch {
                  // Allow invalid JSON while typing
                }
              }}
              placeholder='{"Content-Type": "application/json"}'
              className="font-mono text-xs"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Body</Label>
            <Textarea
              id="body"
              value={data.config.body || ""}
              onChange={(e) => updateConfig({ body: e.target.value })}
              placeholder="Request body or {{node.output.field}}"
              className="font-mono text-xs"
              rows={4}
            />
          </div>
        </>
      )}

      {data.subtype === "slack" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="channel">Channel</Label>
            <Input
              id="channel"
              value={data.config.channel || ""}
              onChange={(e) => updateConfig({ channel: e.target.value })}
              placeholder="#general"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={data.config.message || ""}
              onChange={(e) => updateConfig({ message: e.target.value })}
              placeholder="Use {{node.output.field}} for variables"
              rows={4}
            />
          </div>
        </>
      )}

      {data.subtype === "email" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              value={data.config.url || ""}
              onChange={(e) => updateConfig({ url: e.target.value })}
              placeholder="recipient@example.com or {{node.output.email}}"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Body</Label>
            <Textarea
              id="body"
              value={data.config.body || ""}
              onChange={(e) => updateConfig({ body: e.target.value })}
              placeholder="Email body..."
              rows={4}
            />
          </div>
        </>
      )}
    </div>
  );
}
