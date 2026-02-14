"use client";

import {
  Play,
  Pencil,
  Pause,
  ArchiveIcon,
  MoreHorizontal,
  Webhook,
  Clock,
  MousePointerClick,
  PlayCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/api";

interface AgentCardProps {
  agent: Agent;
  onExecute?: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onArchive?: (id: string) => void;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  draft: { label: "Draft", variant: "outline" },
  active: { label: "Active", variant: "default", className: "bg-green-600 hover:bg-green-600/80" },
  paused: { label: "Paused", variant: "secondary" },
  archived: { label: "Archived", variant: "outline", className: "text-muted-foreground" },
};

const triggerIcons: Record<string, typeof Webhook> = {
  webhook: Webhook,
  schedule: Clock,
  manual: MousePointerClick,
};

const triggerLabels: Record<string, string> = {
  webhook: "Webhook",
  schedule: "Schedule",
  manual: "Manual",
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function AgentCard({
  agent,
  onExecute,
  onPause,
  onResume,
  onArchive,
}: AgentCardProps) {
  const router = useRouter();
  const status = statusConfig[agent.status] || statusConfig.draft;
  const TriggerIcon = triggerIcons[agent.trigger_type || ""] || Webhook;
  const triggerLabel = triggerLabels[agent.trigger_type || ""] || agent.trigger_type || "None";

  return (
    <Card className="group relative flex flex-col p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className="text-sm font-semibold truncate cursor-pointer hover:underline"
              onClick={() => router.push(`/agents/${agent.id}`)}
            >
              {agent.name}
            </h3>
            <Badge variant={status.variant} className={cn("shrink-0", status.className)}>
              {status.label}
            </Badge>
          </div>
          {agent.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {agent.description}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/agents/${agent.id}`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            {agent.status !== "archived" && (
              <DropdownMenuItem onClick={() => onExecute?.(agent.id)}>
                <PlayCircle className="mr-2 h-4 w-4" />
                Execute
              </DropdownMenuItem>
            )}
            {agent.status === "active" && (
              <DropdownMenuItem onClick={() => onPause?.(agent.id)}>
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </DropdownMenuItem>
            )}
            {agent.status === "paused" && (
              <DropdownMenuItem onClick={() => onResume?.(agent.id)}>
                <Play className="mr-2 h-4 w-4" />
                Resume
              </DropdownMenuItem>
            )}
            {agent.status !== "archived" && (
              <DropdownMenuItem
                onClick={() => onArchive?.(agent.id)}
                className="text-destructive focus:text-destructive"
              >
                <ArchiveIcon className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <TriggerIcon className="h-3 w-3" />
          {triggerLabel}
        </span>
        <span>Updated {formatRelativeTime(agent.updated_at)}</span>
      </div>
    </Card>
  );
}
