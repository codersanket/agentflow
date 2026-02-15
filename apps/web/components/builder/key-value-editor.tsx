"use client";

import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface KeyValuePair {
  key: string;
  value: string;
}

interface KeyValueEditorProps {
  value: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

/**
 * Visual key-value pair editor — replaces raw JSON input for
 * HTTP headers and similar structures.
 */
export function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: KeyValueEditorProps) {
  const addRow = () => {
    onChange([...value, { key: "", value: "" }]);
  };

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: "key" | "value", val: string) => {
    const updated = value.map((pair, i) =>
      i === index ? { ...pair, [field]: val } : pair
    );
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {value.map((pair, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={pair.key}
            onChange={(e) => updateRow(index, "key", e.target.value)}
            placeholder={keyPlaceholder}
            className="text-xs flex-1"
          />
          <Input
            value={pair.value}
            onChange={(e) => updateRow(index, "value", e.target.value)}
            placeholder={valuePlaceholder}
            className="text-xs flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => removeRow(index)}
            type="button"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs"
        onClick={addRow}
        type="button"
      >
        <Plus className="h-3 w-3" />
        Add Row
      </Button>
    </div>
  );
}

/** Convert key-value pairs to a plain object */
export function pairsToObject(pairs: KeyValuePair[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const pair of pairs) {
    if (pair.key.trim()) {
      obj[pair.key.trim()] = pair.value;
    }
  }
  return obj;
}

/** Convert a plain object to key-value pairs */
export function objectToPairs(
  obj: Record<string, string> | undefined | null
): KeyValuePair[] {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj).map(([key, value]) => ({
    key,
    value: String(value),
  }));
}
