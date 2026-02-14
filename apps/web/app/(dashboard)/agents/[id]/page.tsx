"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Play,
  Clock,
  RotateCcw,
  Save,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BuilderToolbar } from "@/components/builder/builder-toolbar";
import { BuilderCanvas } from "@/components/builder/builder-canvas";
import { NodePalette } from "@/components/builder/node-palette";
import {
  ExecutionTimeline,
  type TimelineStep,
} from "@/components/executions/execution-timeline";
import { useBuilderStore } from "@/stores/builder-store";
import {
  api,
  type Agent,
  type Execution,
  type AgentVersion,
} from "@/lib/api";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

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

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: agentId } = use(params);
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("builder");

  const {
    isDirty,
    past,
    future,
    agentName,
    undo,
    redo,
    loadDefinition,
    getDefinition,
    setDirty,
  } = useBuilderStore();

  useEffect(() => {
    async function load() {
      try {
        const data = await api.agents.get(agentId);
        setAgent(data);
        loadDefinition(agentId, data.name, { nodes: [], edges: [] });
      } catch {
        router.push("/agents");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [agentId, router, loadDefinition]);

  const handleSave = useCallback(async () => {
    const definition = getDefinition();
    await api.agents.update(agentId, {
      name: agentName,
      settings: { definition },
    });
    setDirty(false);
  }, [agentId, agentName, getDefinition, setDirty]);

  const handleNameChange = useCallback(
    async (name: string) => {
      await api.agents.update(agentId, { name });
      setAgent((prev) => (prev ? { ...prev, name } : prev));
    },
    [agentId]
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) return null;

  return (
    <div className="-m-6 flex h-[calc(100vh-3.5rem)] flex-col">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex h-full flex-col"
      >
        <div className="border-b px-6 pt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">{agent.name}</h2>
            <Badge variant={agent.status === "active" ? "default" : "outline"}>
              {agent.status}
            </Badge>
          </div>
          <TabsList>
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="executions">Executions</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="builder" className="flex-1 m-0 overflow-hidden">
          <div className="flex h-full flex-col">
            <BuilderToolbar
              agentId={agentId}
              agentName={agentName}
              isDirty={isDirty}
              canUndo={past.length > 0}
              canRedo={future.length > 0}
              onUndo={undo}
              onRedo={redo}
              onSave={handleSave}
              onNameChange={handleNameChange}
            />
            <div className="flex flex-1 overflow-hidden">
              <NodePalette />
              <div className="flex-1">
                <BuilderCanvas />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="executions" className="flex-1 m-0 overflow-auto p-6">
          <ExecutionsTab agentId={agentId} />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 m-0 overflow-auto p-6">
          <SettingsTab agent={agent} onUpdate={setAgent} />
        </TabsContent>

        <TabsContent value="versions" className="flex-1 m-0 overflow-auto p-6">
          <VersionsTab agentId={agentId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExecutionsTab({ agentId }: { agentId: string }) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [steps, setSteps] = useState<TimelineStep[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.executions.list({ agent_id: agentId, limit: "50" });
        setExecutions(res.items);
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [agentId]);

  const handleExpand = async (executionId: string) => {
    if (expandedId === executionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(executionId);
    try {
      const data = await api.executions.steps(executionId);
      setSteps(
        data.map((s) => ({
          id: s.id,
          node_name: s.node_id || `Step ${s.step_order}`,
          status: s.status as TimelineStep["status"],
          duration_ms: s.duration_ms,
          tokens_used: s.tokens_used,
          input_data: s.input_data,
          output_data: s.output_data,
          error_message: s.error_message,
        }))
      );
    } catch {
      setSteps([]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
        <Play className="h-10 w-10 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No executions yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Run this agent to see execution history here.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Triggered By</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Tokens</TableHead>
          <TableHead>Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {executions.map((exec) => (
          <>
            <TableRow
              key={exec.id}
              className="cursor-pointer hover:bg-accent/50"
              onClick={() => handleExpand(exec.id)}
            >
              <TableCell>
                <ExecutionStatusBadge status={exec.status} />
              </TableCell>
              <TableCell className="text-sm">{exec.triggered_by}</TableCell>
              <TableCell className="text-sm">
                {exec.started_at
                  ? formatRelativeTime(exec.started_at)
                  : "-"}
              </TableCell>
              <TableCell className="text-sm">
                {exec.started_at && exec.completed_at
                  ? formatDuration(
                      new Date(exec.completed_at).getTime() -
                        new Date(exec.started_at).getTime()
                    )
                  : "-"}
              </TableCell>
              <TableCell className="text-sm">{exec.total_tokens}</TableCell>
              <TableCell className="text-sm">
                ${exec.total_cost.toFixed(4)}
              </TableCell>
            </TableRow>
            {expandedId === exec.id && (
              <TableRow key={`${exec.id}-detail`}>
                <TableCell colSpan={6} className="p-4">
                  <ExecutionTimeline steps={steps} />
                </TableCell>
              </TableRow>
            )}
          </>
        ))}
      </TableBody>
    </Table>
  );
}

function SettingsTab({
  agent,
  onUpdate,
}: {
  agent: Agent;
  onUpdate: (agent: Agent) => void;
}) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description || "");
  const [triggerType, setTriggerType] = useState(agent.trigger_type || "manual");
  const [timeout, setTimeout_] = useState(
    String((agent.settings as Record<string, unknown>)?.timeout_seconds ?? 300)
  );
  const [maxRetries, setMaxRetries] = useState(
    String((agent.settings as Record<string, unknown>)?.max_retries ?? 3)
  );
  const [concurrency, setConcurrency] = useState(
    String((agent.settings as Record<string, unknown>)?.concurrency_limit ?? 5)
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await api.agents.update(agent.id, {
        name,
        description: description || undefined,
        trigger_type: triggerType,
        settings: {
          timeout_seconds: Number(timeout),
          max_retries: Number(maxRetries),
          concurrency_limit: Number(concurrency),
        },
      });
      onUpdate(updated);
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="space-y-2">
        <Label htmlFor="settings-name">Name</Label>
        <Input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-description">Description</Label>
        <Textarea
          id="settings-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label>Trigger Type</Label>
        <Select value={triggerType} onValueChange={setTriggerType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="webhook">Webhook</SelectItem>
            <SelectItem value="schedule">Schedule</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="settings-timeout">Timeout (sec)</Label>
          <Input
            id="settings-timeout"
            type="number"
            value={timeout}
            onChange={(e) => setTimeout_(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-retries">Max Retries</Label>
          <Input
            id="settings-retries"
            type="number"
            value={maxRetries}
            onChange={(e) => setMaxRetries(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-concurrency">Concurrency</Label>
          <Input
            id="settings-concurrency"
            type="number"
            value={concurrency}
            onChange={(e) => setConcurrency(e.target.value)}
          />
        </div>
      </div>
      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        <Save className="mr-1.5 h-3.5 w-3.5" />
        Save Settings
      </Button>
    </div>
  );
}

function VersionsTab({ agentId }: { agentId: string }) {
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.agents.versions(agentId);
        setVersions(data);
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [agentId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
        <Clock className="h-10 w-10 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No versions yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Publish this agent to create the first version.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {versions.map((version) => (
        <div
          key={version.id}
          className="flex items-center justify-between rounded-lg border p-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">v{version.version}</span>
              {version.is_published && (
                <Badge variant="default" className="bg-green-600 hover:bg-green-600/80">
                  Published
                </Badge>
              )}
            </div>
            {version.change_message && (
              <p className="text-sm text-muted-foreground">
                {version.change_message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatRelativeTime(version.created_at)}
            </p>
          </div>
          <Button variant="outline" size="sm">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Rollback
          </Button>
        </div>
      ))}
    </div>
  );
}

function ExecutionStatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
  > = {
    pending: { label: "Pending", variant: "outline" },
    running: { label: "Running", variant: "default" },
    completed: { label: "Completed", variant: "secondary" },
    failed: { label: "Failed", variant: "destructive" },
    cancelled: { label: "Cancelled", variant: "outline" },
  };
  const c = config[status] || { label: status, variant: "outline" as const };
  return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
}
