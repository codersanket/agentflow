"use client";

import { create } from "zustand";

export interface ExecutionStep {
  id: string;
  node_id: string;
  node_name: string;
  step_order: number;
  status: "pending" | "running" | "completed" | "failed" | "waiting_approval";
  input_data?: Record<string, unknown>;
  output_data?: Record<string, unknown>;
  error_message?: string;
  tokens_used: number;
  cost: number;
  duration_ms: number;
  started_at?: string;
  completed_at?: string;
}

export interface ExecutionLog {
  id: string;
  step_id?: string;
  level: "debug" | "info" | "warning" | "error";
  message: string;
  data?: Record<string, unknown>;
  created_at: string;
}

export interface Execution {
  id: string;
  agent_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  triggered_by: string;
  trigger_data?: Record<string, unknown>;
  started_at?: string;
  completed_at?: string;
  total_tokens: number;
  total_cost: number;
  error_message?: string;
}

interface ExecutionState {
  currentExecution: Execution | null;
  steps: ExecutionStep[];
  logs: ExecutionLog[];
  isStreaming: boolean;
  wsConnection: WebSocket | null;
}

interface ExecutionActions {
  startStreaming: (executionId: string) => void;
  stopStreaming: () => void;
  addStep: (step: ExecutionStep) => void;
  addLog: (log: ExecutionLog) => void;
  updateStep: (stepId: string, updates: Partial<ExecutionStep>) => void;
  setExecution: (execution: Execution | null) => void;
  reset: () => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export const useExecutionStore = create<ExecutionState & ExecutionActions>(
  (set, get) => ({
    currentExecution: null,
    steps: [],
    logs: [],
    isStreaming: false,
    wsConnection: null,

    startStreaming: (executionId: string) => {
      const existing = get().wsConnection;
      if (existing) {
        existing.close();
      }

      const ws = new WebSocket(
        `${WS_URL}/api/v1/executions/${executionId}/stream`
      );

      ws.onopen = () => {
        set({ isStreaming: true, wsConnection: ws });
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "execution.started":
            set((state) => ({
              currentExecution: state.currentExecution
                ? { ...state.currentExecution, status: "running", started_at: data.timestamp }
                : null,
            }));
            break;

          case "step.started":
            get().addStep({
              id: data.step_id,
              node_id: data.node_id,
              node_name: data.node_name || "Step",
              step_order: data.step_order || get().steps.length,
              status: "running",
              tokens_used: 0,
              cost: 0,
              duration_ms: 0,
              started_at: data.timestamp,
            });
            break;

          case "step.completed":
            get().updateStep(data.step_id, {
              status: "completed",
              output_data: data.output,
              tokens_used: data.tokens_used || 0,
              cost: data.cost || 0,
              duration_ms: data.duration_ms || 0,
              completed_at: data.timestamp,
            });
            break;

          case "step.failed":
            get().updateStep(data.step_id, {
              status: "failed",
              error_message: data.error,
              completed_at: data.timestamp,
            });
            break;

          case "step.waiting_approval":
            get().updateStep(data.step_id, {
              status: "waiting_approval",
            });
            break;

          case "execution.completed":
            set((state) => ({
              currentExecution: state.currentExecution
                ? {
                    ...state.currentExecution,
                    status: "completed",
                    completed_at: data.timestamp,
                    total_tokens: data.total_tokens || state.currentExecution.total_tokens,
                    total_cost: data.total_cost || state.currentExecution.total_cost,
                  }
                : null,
              isStreaming: false,
            }));
            break;

          case "execution.failed":
            set((state) => ({
              currentExecution: state.currentExecution
                ? {
                    ...state.currentExecution,
                    status: "failed",
                    error_message: data.error,
                    completed_at: data.timestamp,
                  }
                : null,
              isStreaming: false,
            }));
            break;

          case "execution.cancelled":
            set((state) => ({
              currentExecution: state.currentExecution
                ? { ...state.currentExecution, status: "cancelled" }
                : null,
              isStreaming: false,
            }));
            break;

          case "log":
            get().addLog({
              id: data.id || crypto.randomUUID(),
              step_id: data.step_id,
              level: data.level || "info",
              message: data.message,
              data: data.data,
              created_at: data.timestamp || new Date().toISOString(),
            });
            break;
        }
      };

      ws.onerror = () => {
        set({ isStreaming: false });
      };

      ws.onclose = () => {
        set({ isStreaming: false, wsConnection: null });
      };
    },

    stopStreaming: () => {
      const ws = get().wsConnection;
      if (ws) {
        ws.close();
      }
      set({ isStreaming: false, wsConnection: null });
    },

    addStep: (step) => {
      set((state) => ({
        steps: [...state.steps, step],
      }));
    },

    addLog: (log) => {
      set((state) => ({
        logs: [...state.logs, log],
      }));
    },

    updateStep: (stepId, updates) => {
      set((state) => ({
        steps: state.steps.map((s) =>
          s.id === stepId ? { ...s, ...updates } : s
        ),
      }));
    },

    setExecution: (execution) => {
      set({ currentExecution: execution });
    },

    reset: () => {
      const ws = get().wsConnection;
      if (ws) ws.close();
      set({
        currentExecution: null,
        steps: [],
        logs: [],
        isStreaming: false,
        wsConnection: null,
      });
    },
  })
);
