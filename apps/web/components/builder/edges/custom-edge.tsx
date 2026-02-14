"use client";

import { memo } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

const statusColors: Record<string, string> = {
  default: "#94a3b8",
  success: "#22c55e",
  error: "#ef4444",
};

function CustomEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  const status = (data?.status as string) || "default";
  const color = statusColors[status] || statusColors.default;
  const animated = status === "success";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: 2,
          strokeDasharray: animated ? "5 5" : undefined,
        }}
      />
      {data?.label && (
        <foreignObject
          x={labelX - 30}
          y={labelY - 10}
          width={60}
          height={20}
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div className="flex items-center justify-center rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground shadow-sm border">
            {data.label as string}
          </div>
        </foreignObject>
      )}
    </>
  );
}

export const CustomEdge = memo(CustomEdgeComponent);
