"use client";

import { useState } from "react";
import {
  Ticket,
  FileText,
  UserSearch,
  GitPullRequest,
  CalendarClock,
  Download,
  LayoutTemplate,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { Template } from "@/lib/api";

interface TemplateCardProps {
  template: Template;
}

const iconMap: Record<string, typeof Ticket> = {
  ticket: Ticket,
  "file-text": FileText,
  "user-search": UserSearch,
  "git-pull-request": GitPullRequest,
  "calendar-clock": CalendarClock,
};

const categoryColors: Record<string, string> = {
  support: "bg-blue-100 text-blue-800",
  sales: "bg-green-100 text-green-800",
  engineering: "bg-purple-100 text-purple-800",
  hr: "bg-orange-100 text-orange-800",
  marketing: "bg-pink-100 text-pink-800",
};

export function TemplateCard({ template }: TemplateCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(template.name);
  const [installing, setInstalling] = useState(false);

  const Icon = iconMap[template.icon || ""] || LayoutTemplate;
  const categoryClass = categoryColors[template.category || ""] || "bg-secondary text-secondary-foreground";

  async function handleInstall() {
    setInstalling(true);
    try {
      const agent = await api.templates.install(template.id, { name });
      setOpen(false);
      router.push(`/agents/${agent.id}`);
    } catch {
      setInstalling(false);
    }
  }

  return (
    <Card className="flex flex-col p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">{template.name}</h3>
          {template.category && (
            <Badge variant="secondary" className={`mt-1 text-[10px] ${categoryClass}`}>
              {template.category}
            </Badge>
          )}
        </div>
        {template.is_official && (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            Official
          </Badge>
        )}
      </div>

      {template.description && (
        <p className="mt-3 text-xs text-muted-foreground line-clamp-2">
          {template.description}
        </p>
      )}

      <div className="mt-auto pt-4 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Download className="h-3 w-3" />
          {template.install_count} installs
        </span>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="default">
              Install
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Install Template</DialogTitle>
              <DialogDescription>
                This will create a new agent from the &ldquo;{template.name}&rdquo; template.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Agent Name</Label>
                <Input
                  id="agent-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter agent name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={installing}>
                Cancel
              </Button>
              <Button onClick={handleInstall} disabled={installing || !name.trim()}>
                {installing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Install
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}
