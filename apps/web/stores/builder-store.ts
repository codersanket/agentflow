import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type OnConnect,
} from "@xyflow/react";
import type { AgentNode, AgentEdge, AgentDefinition, AgentNodeData } from "@/types/builder";

interface HistoryEntry {
  nodes: AgentNode[];
  edges: AgentEdge[];
}

interface BuilderState {
  nodes: AgentNode[];
  edges: AgentEdge[];
  selectedNodeId: string | null;
  isDirty: boolean;
  agentId: string | null;
  agentName: string;
  past: HistoryEntry[];
  future: HistoryEntry[];
}

interface BuilderActions {
  onNodesChange: (changes: NodeChange<AgentNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<AgentEdge>[]) => void;
  onConnect: OnConnect;
  addNode: (node: AgentNode) => void;
  removeNode: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  updateNodeData: (nodeId: string, data: Partial<AgentNodeData>) => void;
  setDirty: (dirty: boolean) => void;
  loadDefinition: (agentId: string, name: string, definition: AgentDefinition) => void;
  getDefinition: () => AgentDefinition;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

const MAX_HISTORY = 50;

export const useBuilderStore = create<BuilderState & BuilderActions>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isDirty: false,
  agentId: null,
  agentName: "Untitled Agent",
  past: [],
  future: [],

  pushHistory: () => {
    const { nodes, edges, past } = get();
    const entry: HistoryEntry = {
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
    };
    set({
      past: [...past.slice(-MAX_HISTORY), entry],
      future: [],
    });
  },

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
      isDirty: true,
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      isDirty: true,
    }));
  },

  onConnect: (connection) => {
    get().pushHistory();
    set((state) => ({
      edges: addEdge(connection, state.edges),
      isDirty: true,
    }));
  },

  addNode: (node) => {
    get().pushHistory();
    set((state) => ({
      nodes: [...state.nodes, node],
      isDirty: true,
    }));
  },

  removeNode: (nodeId) => {
    get().pushHistory();
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      isDirty: true,
    }));
  },

  selectNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  updateNodeData: (nodeId, data) => {
    get().pushHistory();
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } as AgentNodeData } : n
      ),
      isDirty: true,
    }));
  },

  setDirty: (dirty) => {
    set({ isDirty: dirty });
  },

  loadDefinition: (agentId, name, definition) => {
    set({
      agentId,
      agentName: name,
      nodes: definition.nodes,
      edges: definition.edges,
      selectedNodeId: null,
      isDirty: false,
      past: [],
      future: [],
    });
  },

  getDefinition: () => {
    const { nodes, edges } = get();
    return { nodes, edges };
  },

  undo: () => {
    const { past, nodes, edges } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      future: [{ nodes: structuredClone(nodes), edges: structuredClone(edges) }, ...get().future],
      nodes: previous.nodes,
      edges: previous.edges,
      isDirty: true,
    });
  },

  redo: () => {
    const { future, nodes, edges } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      future: future.slice(1),
      past: [...get().past, { nodes: structuredClone(nodes), edges: structuredClone(edges) }],
      nodes: next.nodes,
      edges: next.edges,
      isDirty: true,
    });
  },
}));
