"use client";

import { useCallback, useRef, type DragEvent } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useBuilderStore } from "@/stores/builder-store";
import { TriggerNode } from "./nodes/trigger-node";
import { AINode } from "./nodes/ai-node";
import { ActionNode } from "./nodes/action-node";
import { LogicNode } from "./nodes/logic-node";
import { HumanNode } from "./nodes/human-node";
import { CustomEdge } from "./edges/custom-edge";
import type { AgentNode, AgentEdge, AgentNodeData, NodeCategory, NodeSubtype } from "@/types/builder";

const nodeTypes = {
  trigger: TriggerNode,
  ai: AINode,
  action: ActionNode,
  logic: LogicNode,
  human: HumanNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

function getDefaultData(type: NodeCategory, subtype: NodeSubtype, label: string): AgentNodeData {
  switch (type) {
    case "trigger":
      return { type: "trigger", subtype: subtype as "webhook" | "schedule" | "manual", label, config: {} };
    case "ai":
      return {
        type: "ai",
        subtype: subtype as "chat" | "summarize" | "classify" | "extract",
        label,
        config: { model: "gpt-4o", system_prompt: "", user_prompt: "", temperature: 0.7, max_tokens: 4096 },
      };
    case "action":
      return {
        type: "action",
        subtype: subtype as "http" | "slack" | "webhook_out" | "email",
        label,
        config: { action_type: subtype, url: "", method: "POST", headers: {}, body: "" },
      };
    case "logic":
      return {
        type: "logic",
        subtype: subtype as "if_else" | "switch" | "loop",
        label,
        config: { logic_type: subtype, condition: { field: "", operator: "equals", value: "" } },
      };
    case "human":
      return {
        type: "human",
        subtype: subtype as "approval" | "input",
        label,
        config: { message: "", timeout_minutes: 60 },
      };
  }
}

export function BuilderCanvas() {
  const reactFlowRef = useRef<ReactFlowInstance<AgentNode, AgentEdge> | null>(null);
  const nodes = useBuilderStore((s) => s.nodes);
  const edges = useBuilderStore((s) => s.edges);
  const onNodesChange = useBuilderStore((s) => s.onNodesChange);
  const onEdgesChange = useBuilderStore((s) => s.onEdgesChange);
  const onConnect = useBuilderStore((s) => s.onConnect);
  const addNode = useBuilderStore((s) => s.addNode);
  const selectNode = useBuilderStore((s) => s.selectNode);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/agentflow-node");
      if (!raw || !reactFlowRef.current) return;

      const { type, subtype, label } = JSON.parse(raw) as {
        type: NodeCategory;
        subtype: NodeSubtype;
        label: string;
      };

      const position = reactFlowRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: AgentNode = {
        id: `${type}_${crypto.randomUUID().slice(0, 8)}`,
        type,
        position,
        data: getDefaultData(type, subtype, label),
      };

      addNode(newNode);
    },
    [addNode]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: AgentNode) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  return (
    <div className="h-full w-full">
      <ReactFlow<AgentNode, AgentEdge>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(instance) => {
          reactFlowRef.current = instance;
        }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: "custom" }}
        fitView
        deleteKeyCode={["Backspace", "Delete"]}
        className="bg-background"
      >
        <Controls className="!border !border-border !bg-background !shadow-sm [&>button]:!border-border [&>button]:!bg-background" />
        <MiniMap
          className="!border !border-border !bg-muted !shadow-sm"
          maskColor="hsl(var(--muted) / 0.7)"
          nodeColor={(n) => {
            const colors: Record<string, string> = {
              trigger: "#10b981",
              ai: "#8b5cf6",
              action: "#3b82f6",
              logic: "#f59e0b",
              human: "#f43f5e",
            };
            return colors[n.type || ""] || "#94a3b8";
          }}
        />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--border))" />
      </ReactFlow>
    </div>
  );
}
