"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { UserCheck } from "lucide-react";
import { BaseNode } from "./base-node";
import type { AgentNode, HumanNodeData } from "@/types/builder";

function HumanNodeComponent(props: NodeProps<AgentNode>) {
  const data = props.data as HumanNodeData;

  return (
    <BaseNode id={props.id} data={data} selected={props.selected} icon={<UserCheck className="h-3.5 w-3.5" />}>
      {data.config.message && (
        <p className="line-clamp-2 text-[10px] leading-relaxed">{data.config.message}</p>
      )}
    </BaseNode>
  );
}

export const HumanNode = memo(HumanNodeComponent);
