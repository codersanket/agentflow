import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground">
          Monitor usage, costs, and performance metrics.
        </p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
        <BarChart3 className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No data yet</h3>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          Analytics will appear here once your agents start running.
        </p>
      </div>
    </div>
  );
}
