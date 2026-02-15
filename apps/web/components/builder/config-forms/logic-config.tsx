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
import { VariablePicker } from "@/components/builder/variable-picker";
import type { LogicNodeData } from "@/types/builder";

interface LogicConfigProps {
  nodeId: string;
  data: LogicNodeData;
}

const operators = [
  { value: "equals", label: "Equals", desc: "Exact match" },
  { value: "not_equals", label: "Not Equals", desc: "Does not match" },
  { value: "contains", label: "Contains", desc: "Text includes" },
  { value: "gt", label: "Greater Than", desc: "Number comparison" },
  { value: "lt", label: "Less Than", desc: "Number comparison" },
  { value: "gte", label: "Greater or Equal", desc: "Number comparison" },
  { value: "lte", label: "Less or Equal", desc: "Number comparison" },
  { value: "is_empty", label: "Is Empty", desc: "No value" },
  { value: "is_not_empty", label: "Is Not Empty", desc: "Has any value" },
];

export function LogicConfig({ nodeId, data }: LogicConfigProps) {
  const updateNodeData = useBuilderStore((s) => s.updateNodeData);

  const updateConfig = (updates: Partial<LogicNodeData["config"]>) => {
    updateNodeData(nodeId, {
      config: { ...data.config, ...updates },
    } as Partial<LogicNodeData>);
  };

  const updateCondition = (
    updates: Partial<NonNullable<LogicNodeData["config"]["condition"]>>
  ) => {
    updateConfig({
      condition: { ...data.config.condition!, ...updates },
    });
  };

  const op = data.config.condition?.operator || "equals";
  const hideValue = op === "is_empty" || op === "is_not_empty";

  return (
    <div className="space-y-4">
      {(data.subtype === "if_else" ||
        data.subtype === "condition" ||
        data.subtype === "switch") && (
        <>
          <div className="rounded-md border bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Route the flow based on a condition. The <strong>True</strong>{" "}
              path runs when the condition matches, otherwise the{" "}
              <strong>False</strong> path runs.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="field">
                Check this value
              </Label>
              <VariablePicker
                nodeId={nodeId}
                onInsert={(v) => updateCondition({ field: v })}
              />
            </div>
            <Input
              id="field"
              value={data.config.condition?.field || ""}
              onChange={(e) => updateCondition({ field: e.target.value })}
              placeholder="Click 'Insert Variable' or type a value"
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Condition</Label>
            <Select
              value={op}
              onValueChange={(v) => updateCondition({ operator: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operators.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span>{o.label}</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      {o.desc}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!hideValue && (
            <div className="space-y-2">
              <Label htmlFor="value">Compare to</Label>
              <Input
                id="value"
                value={data.config.condition?.value || ""}
                onChange={(e) => updateCondition({ value: e.target.value })}
                placeholder="Expected value"
              />
            </div>
          )}

          {/* Visual summary */}
          {data.config.condition?.field && (
            <div className="rounded-md border px-3 py-2">
              <p className="text-xs">
                <span className="font-medium">If </span>
                <code className="bg-muted px-1 rounded text-[11px]">
                  {data.config.condition.field}
                </code>{" "}
                <span className="text-muted-foreground">{op.replace(/_/g, " ")}</span>
                {!hideValue && data.config.condition.value && (
                  <>
                    {" "}
                    <code className="bg-muted px-1 rounded text-[11px]">
                      {data.config.condition.value}
                    </code>
                  </>
                )}
              </p>
            </div>
          )}
        </>
      )}

      {data.subtype === "loop" && (
        <>
          <div className="rounded-md border bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Repeat the next steps for each item in a list.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="items">Loop over</Label>
              <VariablePicker
                nodeId={nodeId}
                onInsert={(v) => updateConfig({ items_expression: v })}
              />
            </div>
            <Input
              id="items"
              value={data.config.items_expression || ""}
              onChange={(e) =>
                updateConfig({ items_expression: e.target.value })
              }
              placeholder="Click 'Insert Variable' to select a list"
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Select the list of items to iterate over from a previous step.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-iterations">
              Safety limit
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (max iterations)
              </span>
            </Label>
            <Input
              id="max-iterations"
              type="number"
              value={data.config.max_iterations || 100}
              onChange={(e) =>
                updateConfig({
                  max_iterations: parseInt(e.target.value) || 100,
                })
              }
              min={1}
              max={10000}
            />
            <p className="text-xs text-muted-foreground">
              Stops the loop after this many iterations to prevent runaway costs. Default: 100.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
