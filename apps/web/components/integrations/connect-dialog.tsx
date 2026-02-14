"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PROVIDER_FIELDS: Record<string, { key: string; label: string; placeholder: string; type?: string }[]> = {
  slack: [
    { key: "bot_token", label: "Bot Token", placeholder: "xoxb-...", type: "password" },
  ],
  webhook: [
    { key: "webhook_base_url", label: "Base URL", placeholder: "https://hooks.example.com" },
  ],
  http_request: [
    { key: "auth_header", label: "Authorization Header (optional)", placeholder: "Bearer sk-..." },
  ],
};

interface ConnectDialogProps {
  provider: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (provider: string, credentials: Record<string, string>, name?: string) => Promise<void>;
}

export function ConnectDialog({
  provider,
  open,
  onOpenChange,
  onConnect,
}: ConnectDialogProps) {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = provider ? (PROVIDER_FIELDS[provider] ?? []) : [];
  const providerName = provider?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "";

  const handleSubmit = async () => {
    if (!provider) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onConnect(provider, credentials, name || undefined);
      setCredentials({});
      setName("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setCredentials({});
      setName("");
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect {providerName}</DialogTitle>
          <DialogDescription>
            Enter the credentials for your {providerName} integration.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="integration-name">Name (optional)</Label>
            <Input
              id="integration-name"
              placeholder={`My ${providerName}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                type={field.type ?? "text"}
                placeholder={field.placeholder}
                value={credentials[field.key] ?? ""}
                onChange={(e) =>
                  setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
              />
            </div>
          ))}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
