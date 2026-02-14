const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface ApiError {
  code: string;
  message: string;
}

interface ApiErrorResponse {
  error: ApiError;
}

export class ApiRequestError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    accessToken = data.access_token;
    return accessToken;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && accessToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        credentials: "include",
      });
    } else {
      accessToken = null;
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new ApiRequestError("Session expired", "SESSION_EXPIRED", 401);
    }
  }

  if (!res.ok) {
    let errorData: ApiErrorResponse;
    try {
      errorData = await res.json();
    } catch {
      throw new ApiRequestError(
        `Request failed with status ${res.status}`,
        "UNKNOWN_ERROR",
        res.status
      );
    }
    throw new ApiRequestError(
      errorData.error?.message || "Unknown error",
      errorData.error?.code || "UNKNOWN_ERROR",
      res.status
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = params
    ? `${path}?${new URLSearchParams(params).toString()}`
    : path;
  return request<T>(url);
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    org_id: string;
    role: string;
  };
}

export interface SignupInput {
  org_name: string;
  full_name: string;
  email: string;
  password: string;
}

export interface SignupResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    org_id: string;
    role: string;
  };
}

export interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  org_id: string;
  role: string;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  status: "draft" | "active" | "paused" | "archived";
  trigger_type?: string;
  trigger_config?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentVersion {
  id: string;
  agent_id: string;
  version: number;
  definition: Record<string, unknown>;
  change_message?: string;
  created_by?: string;
  is_published: boolean;
  created_at: string;
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  trigger_type?: string;
  trigger_config?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface PublishInput {
  change_message?: string;
  definition: Record<string, unknown>;
}

export interface Execution {
  id: string;
  agent_id: string;
  agent_version_id?: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  triggered_by: string;
  trigger_data?: Record<string, unknown>;
  started_at?: string;
  completed_at?: string;
  total_tokens: number;
  total_cost: number;
  error_message?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ExecutionStep {
  id: string;
  execution_id: string;
  node_id?: string;
  step_order: number;
  status: string;
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
  execution_id: string;
  step_id?: string;
  level: string;
  message: string;
  data?: Record<string, unknown>;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  cursor?: string;
  has_more: boolean;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      post<LoginResponse>("/auth/login", { email, password }),
    signup: (data: SignupInput) =>
      post<SignupResponse>("/auth/signup", data),
    me: () => get<UserResponse>("/auth/me"),
    refresh: () => refreshAccessToken(),
  },
  agents: {
    list: (params?: Record<string, string>) =>
      get<PaginatedResponse<Agent>>("/agents", params),
    get: (id: string) => get<Agent>(`/agents/${id}`),
    create: (data: CreateAgentInput) => post<Agent>("/agents", data),
    update: (id: string, data: Partial<CreateAgentInput>) =>
      put<Agent>(`/agents/${id}`, data),
    delete: (id: string) => del<void>(`/agents/${id}`),
    publish: (id: string, data: PublishInput) =>
      post<AgentVersion>(`/agents/${id}/publish`, data),
    versions: (id: string) =>
      get<AgentVersion[]>(`/agents/${id}/versions`),
    updateStatus: (id: string, status: string) =>
      put<Agent>(`/agents/${id}/status`, { status }),
    execute: (id: string, data?: Record<string, unknown>) =>
      post<Execution>(`/agents/${id}/execute`, data),
    test: (id: string, data: Record<string, unknown>) =>
      post<Execution>(`/agents/${id}/test`, data),
  },
  executions: {
    list: (params?: Record<string, string>) =>
      get<PaginatedResponse<Execution>>("/executions", params),
    get: (id: string) => get<Execution>(`/executions/${id}`),
    steps: (id: string) => get<ExecutionStep[]>(`/executions/${id}/steps`),
    logs: (id: string) => get<ExecutionLog[]>(`/executions/${id}/logs`),
    cancel: (id: string) => post<void>(`/executions/${id}/cancel`),
    approve: (id: string) => post<void>(`/executions/${id}/approve`),
  },
};
