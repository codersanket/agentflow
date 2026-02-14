"use client";

import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CostBreakdownItem } from "@/lib/api";

interface CostTableProps {
  data: CostBreakdownItem[];
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

export function CostTable({ data }: CostTableProps) {
  const totalCost = data.reduce((sum, item) => sum + item.total_cost, 0);
  const totalRuns = data.reduce((sum, item) => sum + item.total_runs, 0);
  const totalTokens = data.reduce((sum, item) => sum + item.total_tokens, 0);

  if (data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-4">Cost Breakdown by Agent</h3>
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No cost data available.
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold mb-4">Cost Breakdown by Agent</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead className="text-right">Runs</TableHead>
            <TableHead className="text-right">Tokens</TableHead>
            <TableHead className="text-right">Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.group_id}>
              <TableCell className="font-medium">{item.group_name}</TableCell>
              <TableCell className="text-right">{item.total_runs}</TableCell>
              <TableCell className="text-right">{formatTokens(item.total_tokens)}</TableCell>
              <TableCell className="text-right">{formatCost(item.total_cost)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="font-semibold border-t-2">
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{totalRuns}</TableCell>
            <TableCell className="text-right">{formatTokens(totalTokens)}</TableCell>
            <TableCell className="text-right">{formatCost(totalCost)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  );
}
