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
import { VariablePicker } from "@/components/builder/variable-picker";
import {
  KeyValueEditor,
  objectToPairs,
  pairsToObject,
} from "@/components/builder/key-value-editor";
import type { ActionNodeData } from "@/types/builder";

interface ActionConfigProps {
  nodeId: string;
  data: ActionNodeData;
}

const httpMethods = [
  { value: "GET", desc: "Retrieve data" },
  { value: "POST", desc: "Send data" },
  { value: "PUT", desc: "Replace data" },
  { value: "PATCH", desc: "Update data" },
  { value: "DELETE", desc: "Remove data" },
];

export function ActionConfig({ nodeId, data }: ActionConfigProps) {
  const updateNodeData = useBuilderStore((s) => s.updateNodeData);

  const updateConfig = (updates: Partial<ActionNodeData["config"]>) => {
    updateNodeData(nodeId, {
      config: { ...data.config, ...updates },
    } as Partial<ActionNodeData>);
  };

  return (
    <div className="space-y-4">
      {/* ─── HTTP / Webhook Out ────────────────────────────── */}
      {(data.subtype === "http" ||
        data.subtype === "http_request" ||
        data.subtype === "webhook_out") && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="url">URL</Label>
              <VariablePicker
                nodeId={nodeId}
                onInsert={(v) =>
                  updateConfig({ url: (data.config.url || "") + v })
                }
              />
            </div>
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
                  <SelectItem key={m.value} value={m.value}>
                    <span>{m.value}</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      {m.desc}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Headers</Label>
            <p className="text-xs text-muted-foreground">
              Add request headers as key-value pairs.
            </p>
            <KeyValueEditor
              value={objectToPairs(
                data.config.headers as Record<string, string> | undefined
              )}
              onChange={(pairs) => updateConfig({ headers: pairsToObject(pairs) })}
              keyPlaceholder="Header name"
              valuePlaceholder="Header value"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="body">Body</Label>
              <VariablePicker
                nodeId={nodeId}
                onInsert={(v) =>
                  updateConfig({ body: (data.config.body || "") + v })
                }
              />
            </div>
            <Textarea
              id="body"
              value={data.config.body || ""}
              onChange={(e) => updateConfig({ body: e.target.value })}
              placeholder="Request body — use Insert Variable to reference data from previous steps"
              className="font-mono text-xs"
              rows={4}
            />
          </div>
        </>
      )}

      {/* ─── Slack ────────────────────────────────────────── */}
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
            <p className="text-xs text-muted-foreground">
              Enter the Slack channel name (e.g. #general) or channel ID.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="message">Message</Label>
              <VariablePicker
                nodeId={nodeId}
                onInsert={(v) =>
                  updateConfig({
                    message: (data.config.message || "") + v,
                  })
                }
              />
            </div>
            <Textarea
              id="message"
              value={data.config.message || ""}
              onChange={(e) => updateConfig({ message: e.target.value })}
              placeholder="Write your message here — use Insert Variable to include data from previous steps"
              rows={4}
            />
          </div>
        </>
      )}

      {/* ─── Email ────────────────────────────────────────── */}
      {data.subtype === "email" && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="to">To</Label>
              <VariablePicker
                nodeId={nodeId}
                onInsert={(v) =>
                  updateConfig({ to: (data.config.to || "") + v })
                }
              />
            </div>
            <Input
              id="to"
              type="email"
              value={data.config.to || ""}
              onChange={(e) => updateConfig({ to: e.target.value })}
              placeholder="recipient@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={data.config.subject || ""}
              onChange={(e) => updateConfig({ subject: e.target.value })}
              placeholder="Email subject line"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-body">Body</Label>
              <VariablePicker
                nodeId={nodeId}
                onInsert={(v) =>
                  updateConfig({ body: (data.config.body || "") + v })
                }
              />
            </div>
            <Textarea
              id="email-body"
              value={data.config.body || ""}
              onChange={(e) => updateConfig({ body: e.target.value })}
              placeholder="Write your email body — use Insert Variable to include dynamic content"
              rows={5}
            />
          </div>
        </>
      )}
    </div>
  );
}
