"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Plus,
  Search,
  LayoutGrid,
  List,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgentCard } from "@/components/agents/agent-card";
import { CreateAgentDialog } from "@/components/agents/create-agent-dialog";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { api, type Agent } from "@/lib/api";
import { toast } from "sonner";

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [triggerFilter, setTriggerFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [createOpen, setCreateOpen] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!isLoading && agents.length === 0 && !error) {
      const dismissed = localStorage.getItem("agentflow_onboarding_dismissed");
      if (!dismissed) {
        setShowOnboarding(true);
      }
    }
  }, [isLoading, agents.length, error]);

  const handleOnboardingComplete = (agentId: string) => {
    localStorage.setItem("agentflow_onboarding_dismissed", "true");
    router.push(`/agents/${agentId}`);
  };

  const handleOnboardingSkip = () => {
    localStorage.setItem("agentflow_onboarding_dismissed", "true");
    setShowOnboarding(false);
  };

  const fetchAgents = useCallback(async (loadMore = false) => {
    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const params: Record<string, string> = { limit: "20" };
      if (statusFilter !== "all") params.status = statusFilter;
      if (triggerFilter !== "all") params.trigger_type = triggerFilter;
      if (search.trim()) params.search = search.trim();
      if (loadMore && cursor) params.cursor = cursor;

      const res = await api.agents.list(params);
      if (loadMore) {
        setAgents((prev) => [...prev, ...res.items]);
      } else {
        setAgents(res.items);
      }
      setCursor(res.cursor);
      setHasMore(res.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [statusFilter, triggerFilter, search, cursor]);

  useEffect(() => {
    setCursor(undefined);
    fetchAgents(false);
  }, [statusFilter, triggerFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCursor(undefined);
      fetchAgents(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleStatusChange = async (agentId: string, status: string) => {
    try {
      await api.agents.updateStatus(agentId, status);
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId ? { ...a, status: status as Agent["status"] } : a
        )
      );
    } catch {
      toast.error("Failed to update agent status");
    }
  };

  const handleExecute = async (agentId: string) => {
    try {
      await api.agents.execute(agentId);
    } catch {
      toast.error("Failed to execute agent");
    }
  };

  if (showOnboarding) {
    return (
      <div className="relative">
        <OnboardingWizard
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Agents</h2>
          <p className="text-muted-foreground">
            Create and manage your AI agents.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Create Agent
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={triggerFilter} onValueChange={setTriggerFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Trigger" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Triggers</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="webhook">Webhook</SelectItem>
            <SelectItem value="schedule">Schedule</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-r-none"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-l-none"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => fetchAgents(false)}
          >
            Retry
          </Button>
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
          <Bot className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No agents yet</h3>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            Get started by creating your first AI agent.
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create Agent
          </Button>
        </div>
      ) : (
        <>
          <div
            className={
              viewMode === "grid"
                ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                : "space-y-3"
            }
          >
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onExecute={handleExecute}
                onPause={(id) => handleStatusChange(id, "paused")}
                onResume={(id) => handleStatusChange(id, "active")}
                onArchive={(id) => handleStatusChange(id, "archived")}
              />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchAgents(true)}
                disabled={isLoadingMore}
              >
                {isLoadingMore && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Load More
              </Button>
            </div>
          )}
        </>
      )}

      <CreateAgentDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
