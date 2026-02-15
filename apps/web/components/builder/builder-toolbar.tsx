"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Upload,
  Play,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useBuilderStore } from "@/stores/builder-store";
import { PublishDialog } from "./publish-dialog";
import { TestRunDialog } from "./test-run-dialog";

interface BuilderToolbarProps {
  agentId: string;
  agentName: string;
  isDirty?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  onSave?: () => Promise<void>;
  onNameChange?: (name: string) => void;
}

export function BuilderToolbar({
  agentId,
  agentName,
  isDirty = false,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFitView,
  onSave,
  onNameChange,
}: BuilderToolbarProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [nameValue, setNameValue] = useState(agentName);
  const [isSaving, setIsSaving] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const getDefinition = useBuilderStore((s) => s.getDefinition);

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  }, [onSave]);

  const handleNameSubmit = useCallback(() => {
    setIsEditing(false);
    if (nameValue.trim() && nameValue !== agentName) {
      onNameChange?.(nameValue.trim());
    } else {
      setNameValue(agentName);
    }
  }, [nameValue, agentName, onNameChange]);

  return (
    <>
      <div className="flex h-14 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/agents")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {isEditing ? (
            <Input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSubmit();
                if (e.key === "Escape") {
                  setNameValue(agentName);
                  setIsEditing(false);
                }
              }}
              className="h-8 w-56"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm font-semibold hover:bg-accent rounded px-2 py-1 transition-colors"
            >
              {agentName}
            </button>
          )}

          {isDirty && (
            <span className="text-xs text-muted-foreground">Unsaved</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </Button>

          <div className="mx-2 h-6 w-px bg-border" />

          <Button
            variant="ghost"
            size="icon"
            onClick={onZoomOut}
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onZoomIn}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onFitView}
            title="Fit to screen"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>

          <div className="mx-2 h-6 w-px bg-border" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setTestOpen(true)}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Test
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save
          </Button>
          <Button size="sm" onClick={() => setPublishOpen(true)}>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Publish
          </Button>
        </div>
      </div>

      <PublishDialog
        agentId={agentId}
        open={publishOpen}
        onOpenChange={setPublishOpen}
        getDefinition={() => {
          const { nodes, edges } = getDefinition();
          return {
            nodes: nodes.map((n) => ({
              id: n.id,
              node_type: n.data.type,
              node_subtype: n.data.subtype,
              label: n.data.label,
              config: n.data.config,
              position_x: n.position.x,
              position_y: n.position.y,
            })),
            edges: edges.map((e) => ({
              id: e.id,
              source_node_id: e.source,
              target_node_id: e.target,
              condition: null,
              label: e.data?.label,
            })),
          };
        }}
      />
      <TestRunDialog
        agentId={agentId}
        open={testOpen}
        onOpenChange={setTestOpen}
      />
    </>
  );
}
