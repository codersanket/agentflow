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
import { VariablePicker } from "@/components/builder/variable-picker";
import type { AINodeData } from "@/types/builder";

interface AIConfigProps {
  nodeId: string;
  data: AINodeData;
}

const models = [
  {
    value: "gpt-4o",
    label: "GPT-4o",
    desc: "Fast and capable, good all-rounder",
  },
  {
    value: "gpt-4o-mini",
    label: "GPT-4o Mini",
    desc: "Cheapest option, great for simple tasks",
  },
  {
    value: "claude-sonnet-4-5-20250929",
    label: "Claude Sonnet 4.5",
    desc: "Excellent at analysis and writing",
  },
  {
    value: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    desc: "Very fast, low cost",
  },
  {
    value: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    desc: "Google's fast model",
  },
];

const TOKEN_PRESETS = [
  { value: 256, label: "Short (256)" },
  { value: 1024, label: "Medium (1K)" },
  { value: 4096, label: "Long (4K)" },
  { value: 16384, label: "Very Long (16K)" },
];

function tempLabel(temp: number): string {
  if (temp <= 0.2) return "Precise";
  if (temp <= 0.5) return "Balanced";
  if (temp <= 1.0) return "Creative";
  return "Very Random";
}

export function AIConfig({ nodeId, data }: AIConfigProps) {
  const updateNodeData = useBuilderStore((s) => s.updateNodeData);

  const updateConfig = (updates: Partial<AINodeData["config"]>) => {
    updateNodeData(nodeId, {
      config: { ...data.config, ...updates },
    } as Partial<AINodeData>);
  };

  const selectedModel = models.find((m) => m.value === data.config.model);

  return (
    <div className="space-y-4">
      {/* Model Selection */}
      <div className="space-y-2">
        <Label>AI Model</Label>
        <Select
          value={data.config.model}
          onValueChange={(v) => updateConfig({ model: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                <div className="flex flex-col">
                  <span>{m.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {m.desc}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedModel && (
          <p className="text-xs text-muted-foreground">
            {selectedModel.desc}
          </p>
        )}
      </div>

      {/* System Prompt */}
      <div className="space-y-2">
        <Label htmlFor="system-prompt">
          Instructions
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            (tell the AI how to behave)
          </span>
        </Label>
        <Textarea
          id="system-prompt"
          value={data.config.system_prompt}
          onChange={(e) => updateConfig({ system_prompt: e.target.value })}
          placeholder="You are a helpful assistant that summarizes customer feedback..."
          rows={3}
        />
      </div>

      {/* User Prompt */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="user-prompt">
            Prompt
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              (what to process)
            </span>
          </Label>
          <VariablePicker
            nodeId={nodeId}
            onInsert={(v) =>
              updateConfig({
                user_prompt: (data.config.user_prompt || "") + v,
              })
            }
          />
        </div>
        <Textarea
          id="user-prompt"
          value={data.config.user_prompt}
          onChange={(e) => updateConfig({ user_prompt: e.target.value })}
          placeholder="Summarize the following text: {{trigger.data}}"
          rows={4}
        />
      </div>

      {/* Temperature */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Creativity</Label>
          <span className="text-xs text-muted-foreground">
            {data.config.temperature.toFixed(1)} &mdash; {tempLabel(data.config.temperature)}
          </span>
        </div>
        <Slider
          value={[data.config.temperature]}
          onValueChange={([v]) => updateConfig({ temperature: v })}
          min={0}
          max={2}
          step={0.1}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Precise</span>
          <span>Creative</span>
          <span>Random</span>
        </div>
      </div>

      {/* Max Tokens */}
      <div className="space-y-2">
        <Label>
          Response Length
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            (max tokens)
          </span>
        </Label>
        <div className="flex gap-2 flex-wrap">
          {TOKEN_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => updateConfig({ max_tokens: p.value })}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                data.config.max_tokens === p.value
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "hover:bg-accent"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">or</span>
          <Input
            type="number"
            value={data.config.max_tokens}
            onChange={(e) =>
              updateConfig({ max_tokens: parseInt(e.target.value) || 4096 })
            }
            min={1}
            max={128000}
            className="w-28 text-xs"
          />
          <span className="text-xs text-muted-foreground">tokens</span>
        </div>
      </div>
    </div>
  );
}
