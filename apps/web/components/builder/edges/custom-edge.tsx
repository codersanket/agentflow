"use client";

import { memo } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { useExecutionStore } from "@/stores/execution-store";

const statusColors: Record<string, string> = {
  default: "#94a3b8",
  success: "#22c55e",
  error: "#ef4444",
};

function CustomEdgeComponent({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) {
  const sourceStatus = useExecutionStore((s) => s.nodeStatusMap[source]);
  const targetStatus = useExecutionStore((s) => s.nodeStatusMap[target]);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  // Determine edge color based on execution status
  let edgeColor: string;
  let animated: boolean;
  let strokeWidth = 2;

  if (sourceStatus === "completed" && targetStatus === "completed") {
    // Both nodes completed: green edge
    edgeColor = "#22c55e";
    animated = true;
    strokeWidth = 2.5;
  } else if (sourceStatus === "completed" && targetStatus === "running") {
    // Source completed, target running: blue animated edge
    edgeColor = "#3b82f6";
    animated = true;
    strokeWidth = 2.5;
  } else if (sourceStatus === "completed" && targetStatus === "failed") {
    // Source completed, target failed: red edge
    edgeColor = "#ef4444";
    animated = false;
    strokeWidth = 2.5;
  } else {
    // Fall back to data-driven status or default
    const status = (data?.status as string) || "default";
    edgeColor = statusColors[status] || statusColors.default;
    animated = status === "success";
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: edgeColor,
          strokeWidth,
          strokeDasharray: animated ? "5 5" : undefined,
          transition: "stroke 0.3s ease, stroke-width 0.3s ease",
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
