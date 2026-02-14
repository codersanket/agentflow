"use client";

import { type DragEvent } from "react";
import {
  Globe,
  Clock,
  Play,
  Brain,
  Send,
  Webhook,
  Mail,
  GitBranch,
  Repeat,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeCategory, NodeSubtype } from "@/types/builder";

interface PaletteEntry {
  type: NodeCategory;
  subtype: NodeSubtype;
  label: string;
  icon: typeof Globe;
}

const categories: { label: string; type: NodeCategory; items: PaletteEntry[] }[] = [
  {
    label: "Triggers",
    type: "trigger",
    items: [
      { type: "trigger", subtype: "webhook", label: "Webhook", icon: Globe },
      { type: "trigger", subtype: "schedule", label: "Schedule", icon: Clock },
      { type: "trigger", subtype: "manual", label: "Manual", icon: Play },
    ],
  },
  {
    label: "AI",
    type: "ai",
    items: [
      { type: "ai", subtype: "chat", label: "Chat / LLM", icon: Brain },
      { type: "ai", subtype: "summarize", label: "Summarize", icon: Brain },
      { type: "ai", subtype: "classify", label: "Classify", icon: Brain },
      { type: "ai", subtype: "extract", label: "Extract", icon: Brain },
    ],
  },
  {
    label: "Actions",
    type: "action",
    items: [
      { type: "action", subtype: "http", label: "HTTP Request", icon: Globe },
      { type: "action", subtype: "slack", label: "Slack Message", icon: Send },
      { type: "action", subtype: "webhook_out", label: "Webhook", icon: Webhook },
      { type: "action", subtype: "email", label: "Send Email", icon: Mail },
    ],
  },
  {
    label: "Logic",
    type: "logic",
    items: [
      { type: "logic", subtype: "if_else", label: "If / Else", icon: GitBranch },
      { type: "logic", subtype: "loop", label: "Loop", icon: Repeat },
    ],
  },
  {
    label: "Human",
    type: "human",
    items: [
      { type: "human", subtype: "approval", label: "Approval", icon: UserCheck },
    ],
  },
];

const categoryColors: Record<NodeCategory, string> = {
  trigger: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
  ai: "text-violet-600 bg-violet-500/10 border-violet-500/20",
  action: "text-blue-600 bg-blue-500/10 border-blue-500/20",
  logic: "text-amber-600 bg-amber-500/10 border-amber-500/20",
  human: "text-rose-600 bg-rose-500/10 border-rose-500/20",
};

function onDragStart(event: DragEvent, entry: PaletteEntry) {
  event.dataTransfer.setData(
    "application/agentflow-node",
    JSON.stringify({ type: entry.type, subtype: entry.subtype, label: entry.label })
  );
  event.dataTransfer.effectAllowed = "move";
}

export function NodePalette() {
  return (
    <div className="flex h-full w-56 flex-col border-r bg-background">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Nodes</h3>
        <p className="text-xs text-muted-foreground">Drag onto canvas</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {categories.map((category) => (
          <div key={category.type}>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {category.label}
            </p>
            <div className="space-y-1">
              {category.items.map((item) => (
                <div
                  key={`${item.type}-${item.subtype}`}
                  draggable
                  onDragStart={(e) => onDragStart(e, item)}
                  className={cn(
                    "flex cursor-grab items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:shadow-sm active:cursor-grabbing",
                    categoryColors[item.type]
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
