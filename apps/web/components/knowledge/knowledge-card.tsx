"use client";

import { BookOpen, FileText, MoreHorizontal, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { KnowledgeBase } from "@/lib/api";

interface KnowledgeCardProps {
  knowledgeBase: KnowledgeBase;
  onClick?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  active: { label: "Active", variant: "default" },
  deleted: { label: "Deleted", variant: "secondary" },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function KnowledgeCard({
  knowledgeBase,
  onClick,
  onDelete,
}: KnowledgeCardProps) {
  const status = statusConfig[knowledgeBase.status] || statusConfig.active;

  return (
    <Card
      className="group relative flex flex-col p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onClick?.(knowledgeBase.id)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
            <h3 className="text-sm font-semibold truncate">
              {knowledgeBase.name}
            </h3>
            <Badge variant={status.variant} className="shrink-0">
              {status.label}
            </Badge>
          </div>
          {knowledgeBase.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 ml-6">
              {knowledgeBase.description}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(knowledgeBase.id);
              }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground ml-6">
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {knowledgeBase.document_count} document{knowledgeBase.document_count !== 1 ? "s" : ""}
        </span>
        <span>{knowledgeBase.embedding_model}</span>
        <span>Created {formatDate(knowledgeBase.created_at)}</span>
      </div>
    </Card>
  );
}
