"use client";

import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SchemaField {
  name: string;
  type: string;
}

const FIELD_TYPES = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "True / False" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "object", label: "Object (JSON)" },
  { value: "array", label: "List" },
];

interface SchemaBuilderProps {
  /** JSON string like '{"email": "string", "name": "string"}' */
  value: string;
  onChange: (jsonString: string) => void;
}

/**
 * Visual JSON schema builder — replaces raw JSON textarea for
 * webhook payload schemas and manual input schemas.
 */
export function SchemaBuilder({ value, onChange }: SchemaBuilderProps) {
  const fields = parseSchema(value);

  const emit = (updatedFields: SchemaField[]) => {
    const obj: Record<string, string> = {};
    for (const f of updatedFields) {
      if (f.name.trim()) obj[f.name.trim()] = f.type;
    }
    onChange(Object.keys(obj).length > 0 ? JSON.stringify(obj, null, 2) : "");
  };

  const addField = () => {
    emit([...fields, { name: "", type: "string" }]);
  };

  const removeField = (index: number) => {
    emit(fields.filter((_, i) => i !== index));
  };

  const updateField = (
    index: number,
    key: "name" | "type",
    val: string
  ) => {
    const updated = fields.map((f, i) =>
      i === index ? { ...f, [key]: val } : f
    );
    emit(updated);
  };

  return (
    <div className="space-y-2">
      {fields.length > 0 && (
        <div className="flex items-center gap-2 px-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
          <span className="flex-1">Field Name</span>
          <span className="w-28">Type</span>
          <span className="w-8" />
        </div>
      )}
      {fields.map((field, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={field.name}
            onChange={(e) => updateField(index, "name", e.target.value)}
            placeholder="field_name"
            className="text-xs flex-1"
          />
          <Select
            value={field.type}
            onValueChange={(v) => updateField(index, "type", v)}
          >
            <SelectTrigger className="w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => removeField(index)}
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
        onClick={addField}
        type="button"
      >
        <Plus className="h-3 w-3" />
        Add Field
      </Button>
    </div>
  );
}

function parseSchema(json: string): SchemaField[] {
  if (!json || !json.trim()) return [];
  try {
    const obj = JSON.parse(json);
    if (typeof obj !== "object" || Array.isArray(obj)) return [];
    return Object.entries(obj).map(([name, type]) => ({
      name,
      type: typeof type === "string" ? type : "string",
    }));
  } catch {
    return [];
  }
}

/** Convert schema JSON string to form-friendly field definitions */
export function schemaToFields(json: string): { name: string; type: string }[] {
  return parseSchema(json);
}
