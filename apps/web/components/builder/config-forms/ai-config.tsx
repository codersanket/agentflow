"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBuilderStore } from "@/stores/builder-store";
import type { AINodeData } from "@/types/builder";

interface AIConfigProps {
  nodeId: string;
  data: AINodeData;
}

const models = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
];

export function AIConfig({ nodeId, data }: AIConfigProps) {
  const updateNodeData = useBuilderStore((s) => s.updateNodeData);

  const updateConfig = (updates: Partial<AINodeData["config"]>) => {
    updateNodeData(nodeId, {
      config: { ...data.config, ...updates },
    } as Partial<AINodeData>);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Model</Label>
        <Select value={data.config.model} onValueChange={(v) => updateConfig({ model: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="system-prompt">System Prompt</Label>
        <Textarea
          id="system-prompt"
          value={data.config.system_prompt}
          onChange={(e) => updateConfig({ system_prompt: e.target.value })}
          placeholder="You are a helpful assistant..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="user-prompt">User Prompt</Label>
        <Textarea
          id="user-prompt"
          value={data.config.user_prompt}
          onChange={(e) => updateConfig({ user_prompt: e.target.value })}
          placeholder="Use {{node.output.field}} for variables"
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          Reference upstream outputs with {"{{node_name.output.field}}"}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Temperature</Label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {data.config.temperature.toFixed(1)}
          </span>
        </div>
        <Slider
          value={[data.config.temperature]}
          onValueChange={([v]) => updateConfig({ temperature: v })}
          min={0}
          max={2}
          step={0.1}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="max-tokens">Max Tokens</Label>
        <Input
          id="max-tokens"
          type="number"
          value={data.config.max_tokens}
          onChange={(e) => updateConfig({ max_tokens: parseInt(e.target.value) || 4096 })}
          min={1}
          max={128000}
        />
      </div>
    </div>
  );
}
