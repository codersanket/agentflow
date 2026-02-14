"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Send, Globe, Webhook, Mail } from "lucide-react";
import { BaseNode } from "./base-node";
import type { AgentNode, ActionNodeData, ActionSubtype } from "@/types/builder";

const subtypeIcons: Record<ActionSubtype, typeof Send> = {
  slack: Send,
  http: Globe,
  webhook_out: Webhook,
  email: Mail,
};

const subtypeLabels: Record<ActionSubtype, string> = {
  slack: "Slack",
  http: "HTTP Request",
  webhook_out: "Webhook",
  email: "Email",
};

function ActionNodeComponent(props: NodeProps<AgentNode>) {
  const data = props.data as ActionNodeData;
  const Icon = subtypeIcons[data.subtype];

  return (
    <BaseNode id={props.id} data={data} selected={props.selected} icon={<Icon className="h-3.5 w-3.5" />}>
      <span className="text-[10px]">{subtypeLabels[data.subtype]}</span>
    </BaseNode>
  );
}

export const ActionNode = memo(ActionNodeComponent);
