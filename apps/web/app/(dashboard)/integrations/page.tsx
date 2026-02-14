import { Plug } from "lucide-react";

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Integrations</h2>
        <p className="text-muted-foreground">
          Connect your tools and services.
        </p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
        <Plug className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No integrations yet</h3>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          Connect services like Slack, Gmail, and Jira to use in your agents.
        </p>
      </div>
    </div>
  );
}
