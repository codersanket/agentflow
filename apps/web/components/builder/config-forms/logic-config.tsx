"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBuilderStore } from "@/stores/builder-store";
import type { LogicNodeData } from "@/types/builder";

interface LogicConfigProps {
  nodeId: string;
  data: LogicNodeData;
}

const operators = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "gt", label: "Greater Than" },
  { value: "lt", label: "Less Than" },
  { value: "gte", label: "Greater or Equal" },
  { value: "lte", label: "Less or Equal" },
];

export function LogicConfig({ nodeId, data }: LogicConfigProps) {
  const updateNodeData = useBuilderStore((s) => s.updateNodeData);

  const updateConfig = (updates: Partial<LogicNodeData["config"]>) => {
    updateNodeData(nodeId, {
      config: { ...data.config, ...updates },
    } as Partial<LogicNodeData>);
  };

  const updateCondition = (updates: Partial<NonNullable<LogicNodeData["config"]["condition"]>>) => {
    updateConfig({
      condition: { ...data.config.condition!, ...updates },
    });
  };

  return (
    <div className="space-y-4">
      {(data.subtype === "if_else" || data.subtype === "switch") && (
        <>
          <div className="space-y-2">
            <Label htmlFor="field">Field</Label>
            <Input
              id="field"
              value={data.config.condition?.field || ""}
              onChange={(e) => updateCondition({ field: e.target.value })}
              placeholder="{{node_name.output.field}}"
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label>Operator</Label>
            <Select
              value={data.config.condition?.operator || "equals"}
              onValueChange={(v) => updateCondition({ operator: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Value</Label>
            <Input
              id="value"
              value={data.config.condition?.value || ""}
              onChange={(e) => updateCondition({ value: e.target.value })}
              placeholder="Expected value"
            />
          </div>
        </>
      )}

      {data.subtype === "loop" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="items">Items Expression</Label>
            <Input
              id="items"
              value={data.config.items_expression || ""}
              onChange={(e) => updateConfig({ items_expression: e.target.value })}
              placeholder="{{node_name.output.items}}"
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-iterations">Max Iterations</Label>
            <Input
              id="max-iterations"
              type="number"
              value={data.config.max_iterations || 100}
              onChange={(e) => updateConfig({ max_iterations: parseInt(e.target.value) || 100 })}
              min={1}
              max={10000}
            />
          </div>
        </>
      )}
    </div>
  );
}
