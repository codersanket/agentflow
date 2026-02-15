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
  FileText,
  Tags,
  FileSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeCategory, NodeSubtype } from "@/types/builder";

interface PaletteEntry {
  type: NodeCategory;
  subtype: NodeSubtype;
  label: string;
  desc: string;
  icon: typeof Globe;
}

const categories: {
  label: string;
  type: NodeCategory;
  desc: string;
  items: PaletteEntry[];
}[] = [
  {
    label: "Triggers",
    type: "trigger",
    desc: "How your agent starts",
    items: [
      {
        type: "trigger",
        subtype: "webhook",
        label: "Webhook",
        desc: "Start when an external app sends data",
        icon: Globe,
      },
      {
        type: "trigger",
        subtype: "schedule",
        label: "Schedule",
        desc: "Run on a timer (hourly, daily, etc.)",
        icon: Clock,
      },
      {
        type: "trigger",
        subtype: "manual",
        label: "Manual",
        desc: "Start by clicking a button",
        icon: Play,
      },
    ],
  },
  {
    label: "AI",
    type: "ai",
    desc: "Process data with AI",
    items: [
      {
        type: "ai",
        subtype: "chat",
        label: "AI Prompt",
        desc: "Send a prompt and get a response",
        icon: Brain,
      },
      {
        type: "ai",
        subtype: "summarize",
        label: "Summarize",
        desc: "Shorten long text into key points",
        icon: FileText,
      },
      {
        type: "ai",
        subtype: "classify",
        label: "Classify",
        desc: "Sort into categories (positive/negative, etc.)",
        icon: Tags,
      },
      {
        type: "ai",
        subtype: "extract",
        label: "Extract",
        desc: "Pull specific data from text (names, emails, etc.)",
        icon: FileSearch,
      },
    ],
  },
  {
    label: "Actions",
    type: "action",
    desc: "Do something with the result",
    items: [
      {
        type: "action",
        subtype: "http",
        label: "HTTP Request",
        desc: "Call any API or web service",
        icon: Globe,
      },
      {
        type: "action",
        subtype: "slack",
        label: "Slack Message",
        desc: "Send a message to a Slack channel",
        icon: Send,
      },
      {
        type: "action",
        subtype: "webhook_out",
        label: "Webhook",
        desc: "Send data to another app",
        icon: Webhook,
      },
      {
        type: "action",
        subtype: "email",
        label: "Send Email",
        desc: "Send an email notification",
        icon: Mail,
      },
    ],
  },
  {
    label: "Logic",
    type: "logic",
    desc: "Control the flow",
    items: [
      {
        type: "logic",
        subtype: "if_else",
        label: "If / Else",
        desc: "Take different paths based on a condition",
        icon: GitBranch,
      },
      {
        type: "logic",
        subtype: "loop",
        label: "Loop",
        desc: "Repeat steps for each item in a list",
        icon: Repeat,
      },
    ],
  },
  {
    label: "Human",
    type: "human",
    desc: "Add a human step",
    items: [
      {
        type: "human",
        subtype: "approval",
        label: "Approval",
        desc: "Pause and wait for someone to approve",
        icon: UserCheck,
      },
    ],
  },
];

const categoryColors: Record<NodeCategory, string> = {
  trigger: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  ai: "text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20",
  action: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
  logic: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
  human: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
};

function onDragStart(event: DragEvent, entry: PaletteEntry) {
  event.dataTransfer.setData(
    "application/agentflow-node",
    JSON.stringify({
      type: entry.type,
      subtype: entry.subtype,
      label: entry.label,
    })
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
            <p className="mb-0.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {category.label}
            </p>
            <p className="mb-1.5 text-[10px] text-muted-foreground">
              {category.desc}
            </p>
            <div className="space-y-1">
              {category.items.map((item) => (
                <div
                  key={`${item.type}-${item.subtype}`}
                  draggable
                  onDragStart={(e) => onDragStart(e, item)}
                  title={item.desc}
                  className={cn(
                    "flex cursor-grab items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:shadow-sm active:cursor-grabbing group",
                    categoryColors[item.type]
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="block">{item.label}</span>
                    <span className="block text-[9px] font-normal opacity-0 group-hover:opacity-70 transition-opacity truncate">
                      {item.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
