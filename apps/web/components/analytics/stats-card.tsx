"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
  icon?: React.ReactNode;
}

export function StatsCard({ title, value, subtitle, trend, trendValue, icon }: StatsCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        )}
      </div>
      {(subtitle || trendValue) && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          {trend && (
            <span
              className={cn(
                "flex items-center gap-0.5",
                trend === "up" && "text-green-600",
                trend === "down" && "text-red-600"
              )}
            >
              {trend === "up" && <TrendingUp className="h-3 w-3" />}
              {trend === "down" && <TrendingDown className="h-3 w-3" />}
              {trend === "flat" && <Minus className="h-3 w-3" />}
              {trendValue}
            </span>
          )}
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
    </Card>
  );
}
