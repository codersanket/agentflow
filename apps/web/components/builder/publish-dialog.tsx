"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

interface PublishDialogProps {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentVersion?: number;
  getDefinition?: () => Record<string, unknown>;
}

export function PublishDialog({
  agentId,
  open,
  onOpenChange,
  currentVersion = 0,
  getDefinition,
}: PublishDialogProps) {
  const [message, setMessage] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const nextVersion = currentVersion + 1;

  const handlePublish = async () => {
    setIsPublishing(true);
    setError(null);
    try {
      const definition = getDefinition?.() ?? { nodes: [], edges: [] };
      await api.agents.publish(agentId, {
        change_message: message || undefined,
        definition,
      });
      setSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
        setMessage("");
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to publish"
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const handleClose = (value: boolean) => {
    if (!isPublishing) {
      onOpenChange(value);
      if (!value) {
        setMessage("");
        setError(null);
        setSuccess(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish Agent</DialogTitle>
          <DialogDescription>
            Publish version {nextVersion} of this agent. Published versions are
            used when the agent is executed.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center">
            <p className="text-sm font-medium text-green-600">
              Version {nextVersion} published successfully.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="version">Version</Label>
                <p className="text-sm text-muted-foreground">v{nextVersion}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="change-message">Change message</Label>
                <Textarea
                  id="change-message"
                  placeholder="Describe what changed in this version..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isPublishing}
              >
                Cancel
              </Button>
              <Button onClick={handlePublish} disabled={isPublishing}>
                {isPublishing && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Publish v{nextVersion}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
