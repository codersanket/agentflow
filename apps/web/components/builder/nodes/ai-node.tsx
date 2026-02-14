"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BaseNode } from "./base-node";
import type { AgentNode, AINodeData } from "@/types/builder";

function AINodeComponent(props: NodeProps<AgentNode>) {
  const data = props.data as AINodeData;
  const modelShort = data.config.model.split("/").pop() || data.config.model;

  return (
    <BaseNode id={props.id} data={data} selected={props.selected} icon={<Brain className="h-3.5 w-3.5" />}>
      <div className="space-y-1">
        <Badge variant="secondary" className="text-[10px]">
          {modelShort}
        </Badge>
        {data.config.user_prompt && (
          <p className="line-clamp-2 text-[10px] leading-relaxed">
            {data.config.user_prompt}
          </p>
        )}
      </div>
    </BaseNode>
  );
}

export const AINode = memo(AINodeComponent);
