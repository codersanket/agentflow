import { Play } from "lucide-react";

export default function ExecutionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Executions</h2>
        <p className="text-muted-foreground">
          View and monitor agent execution history.
        </p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
        <Play className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No executions yet</h3>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          Executions will appear here once you run an agent.
        </p>
      </div>
    </div>
  );
}
