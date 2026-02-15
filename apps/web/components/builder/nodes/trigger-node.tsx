"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Globe, Clock, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BaseNode } from "./base-node";
import type { AgentNode, TriggerNodeData, TriggerSubtype } from "@/types/builder";

const subtypeIcons: Record<string, typeof Globe> = {
  webhook: Globe,
  schedule: Clock,
  manual: Play,
};

const subtypeLabels: Record<string, string> = {
  webhook: "Webhook",
  schedule: "Schedule",
  manual: "Manual",
};

function TriggerNodeComponent(props: NodeProps<AgentNode>) {
  const data = props.data as TriggerNodeData;
  const Icon = subtypeIcons[data.subtype] || Globe;

  return (
    <BaseNode
      id={props.id}
      data={data}
      selected={props.selected}
      icon={<Icon className="h-3.5 w-3.5" />}
      showInput={false}
    >
      <Badge variant="secondary" className="text-[10px]">
        {subtypeLabels[data.subtype] || data.subtype}
      </Badge>
    </BaseNode>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
