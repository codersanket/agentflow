import { Bot } from "lucide-react";

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Agents</h2>
        <p className="text-muted-foreground">
          Create and manage your AI agents.
        </p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
        <Bot className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No agents yet</h3>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          Get started by creating your first AI agent.
        </p>
      </div>
    </div>
  );
}
