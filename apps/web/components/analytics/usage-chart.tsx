"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import type { UsageDataPoint } from "@/lib/api";

interface UsageChartProps {
  data: UsageDataPoint[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function UsageChart({ data }: UsageChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    dateLabel: formatDate(d.date),
  }));

  if (data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-4">Executions Over Time</h3>
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          No execution data available for this period.
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold mb-4">Executions Over Time</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="success_count"
              name="Successful"
              stroke="hsl(142.1 76.2% 36.3%)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="failure_count"
              name="Failed"
              stroke="hsl(0 84.2% 60.2%)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="total_runs"
              name="Total"
              stroke="hsl(221.2 83.2% 53.3%)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
