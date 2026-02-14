import type { Node, Edge } from "@xyflow/react";

export type NodeCategory = "trigger" | "ai" | "action" | "logic" | "human";

export type TriggerSubtype = "webhook" | "schedule" | "manual";
export type AISubtype = "chat" | "summarize" | "classify" | "extract";
export type ActionSubtype = "http" | "slack" | "webhook_out" | "email";
export type LogicSubtype = "if_else" | "switch" | "loop";
export type HumanSubtype = "approval" | "input";

export type NodeSubtype =
  | TriggerSubtype
  | AISubtype
  | ActionSubtype
  | LogicSubtype
  | HumanSubtype;

export type TriggerNodeData = {
  [key: string]: unknown;
  type: "trigger";
  subtype: TriggerSubtype;
  label: string;
  config: {
    webhook_url?: string;
    payload_schema?: string;
    cron_expression?: string;
    input_schema?: string;
  };
};

export type AINodeData = {
  [key: string]: unknown;
  type: "ai";
  subtype: AISubtype;
  label: string;
  config: {
    model: string;
    system_prompt: string;
    user_prompt: string;
    temperature: number;
    max_tokens: number;
  };
};

export type ActionNodeData = {
  [key: string]: unknown;
  type: "action";
  subtype: ActionSubtype;
  label: string;
  config: {
    action_type: string;
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    channel?: string;
    message?: string;
  };
};

export type LogicNodeData = {
  [key: string]: unknown;
  type: "logic";
  subtype: LogicSubtype;
  label: string;
  config: {
    logic_type: string;
    condition?: {
      field: string;
      operator: string;
      value: string;
    };
    items_expression?: string;
    max_iterations?: number;
  };
};

export type HumanNodeData = {
  [key: string]: unknown;
  type: "human";
  subtype: HumanSubtype;
  label: string;
  config: {
    message: string;
    approvers?: string[];
    timeout_minutes?: number;
  };
};

export type AgentNodeData =
  | TriggerNodeData
  | AINodeData
  | ActionNodeData
  | LogicNodeData
  | HumanNodeData;

export type AgentNode = Node<AgentNodeData>;
export type AgentEdge = Edge<{ [key: string]: unknown; status?: "default" | "success" | "error"; label?: string }>;

export interface AgentDefinition {
  nodes: AgentNode[];
  edges: AgentEdge[];
}

export interface PaletteItem {
  type: NodeCategory;
  subtype: NodeSubtype;
  label: string;
  icon: string;
}
