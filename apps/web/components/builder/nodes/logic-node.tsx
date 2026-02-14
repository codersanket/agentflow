"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { GitBranch, Repeat } from "lucide-react";
import { BaseNode } from "./base-node";
import type { AgentNode, LogicNodeData } from "@/types/builder";

function LogicNodeComponent(props: NodeProps<AgentNode>) {
  const data = props.data as LogicNodeData;
  const isLoop = data.subtype === "loop";
  const Icon = isLoop ? Repeat : GitBranch;

  const outputHandles =
    data.subtype === "if_else"
      ? [
          { id: "true", label: "True" },
          { id: "false", label: "False" },
        ]
      : undefined;

  return (
    <BaseNode
      id={props.id}
      data={data}
      selected={props.selected}
      icon={<Icon className="h-3.5 w-3.5" />}
      outputHandles={outputHandles}
    >
      {data.config.condition && (
        <span className="text-[10px]">
          {data.config.condition.field} {data.config.condition.operator} {data.config.condition.value}
        </span>
      )}
      {isLoop && data.config.items_expression && (
        <span className="text-[10px]">Loop: {data.config.items_expression}</span>
      )}
    </BaseNode>
  );
}

export const LogicNode = memo(LogicNodeComponent);
