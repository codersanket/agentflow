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

async function uploadFile<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
  });

  if (!res.ok) {
    let errorData: ApiErrorResponse;
    try {
      errorData = await res.json();
    } catch {
      throw new ApiRequestError(
        `Upload failed with status ${res.status}`,
        "UPLOAD_ERROR",
        res.status
      );
    }
    throw new ApiRequestError(
      errorData.error?.message || "Upload failed",
      errorData.error?.code || "UPLOAD_ERROR",
      res.status
    );
  }

  return res.json();
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface SignupInput {
  org_name: string;
  name: string;
  email: string;
  password: string;
}

export interface SignupResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: string;
  org: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
}

export interface AgentNodeSchema {
  id: string;
  node_type: string;
  node_subtype: string;
  label?: string;
  config: Record<string, unknown>;
  position_x: number;
  position_y: number;
}

export interface AgentEdgeSchema {
  id: string;
  source_node_id: string;
  target_node_id: string;
  condition?: Record<string, unknown> | null;
  label?: string;
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
  latest_version?: {
    id: string;
    agent_id: string;
    version: number;
    definition: Record<string, unknown>;
    change_message?: string;
    created_by?: string;
    is_published: boolean;
    created_at: string;
    nodes: AgentNodeSchema[];
    edges: AgentEdgeSchema[];
  } | null;
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

export interface Template {
  id: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  is_official: boolean;
  is_public: boolean;
  author_org_id?: string;
  install_count: number;
  rating: number;
  created_at: string;
}

export interface TemplateDetail extends Template {
  definition: Record<string, unknown>;
}

export interface AnalyticsOverview {
  total_executions: number;
  recent_executions: number;
  success_rate: number;
  avg_duration_ms: number;
  active_agents: number;
  total_cost: number;
}

export interface UsageDataPoint {
  date: string;
  total_runs: number;
  total_tokens: number;
  total_cost: number;
  success_count: number;
  failure_count: number;
}

export interface AgentMetrics {
  agent_id: string;
  agent_name: string;
  total_executions: number;
  success_rate: number;
  avg_duration_ms: number;
  total_cost: number;
  total_tokens: number;
}

export interface CostBreakdownItem {
  group_id: string;
  group_name: string;
  total_runs: number;
  total_tokens: number;
  total_cost: number;
}

export interface OrgMember {
  id: string;
  email: string;
  name: string;
  role: string;
  joined_at: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
}

export interface ApiKeyCreated {
  id: string;
  name: string;
  key: string; // Full key, shown only once
}

export interface AIProviderConfig {
  provider: string;
  api_key: string | null;
  base_url: string | null;
  is_configured: boolean;
}

export interface AIProviderTestResult {
  success: boolean;
  message: string;
  model_used: string | null;
}

export interface Integration {
  id: string;
  org_id: string;
  provider: string;
  name?: string;
  status: string;
  scopes?: string[];
  connected_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AvailableIntegration {
  provider: string;
  name: string;
  description: string;
  auth_method: "oauth" | "credentials";
  actions: {
    name: string;
    description: string;
    parameters: Record<string, string>;
  }[];
}

export interface ConnectIntegrationInput {
  name?: string;
  credentials: Record<string, string>;
  scopes?: string[];
}

export interface KnowledgeBase {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  status: string;
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateKnowledgeBaseInput {
  name: string;
  description?: string;
  embedding_model?: string;
  chunk_size?: number;
  chunk_overlap?: number;
}

export interface KBDocument {
  id: string;
  knowledge_base_id: string;
  name: string;
  source_type: string;
  source_url?: string;
  file_type?: string;
  file_size_bytes?: number;
  status: string;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentUploadResponse {
  id: string;
  name: string;
  status: string;
  message: string;
}

export interface QueryResult {
  chunk_id: string;
  document_id: string;
  content: string;
  metadata?: Record<string, unknown>;
  chunk_index: number;
  similarity: number;
}

export interface QueryResponse {
  query: string;
  results: QueryResult[];
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
    rollback: (agentId: string, versionId: string) =>
      post<Agent>(`/agents/${agentId}/versions/${versionId}/rollback`),
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
  templates: {
    list: (params?: Record<string, string>) =>
      get<PaginatedResponse<Template>>("/templates", params),
    get: (id: string) => get<TemplateDetail>(`/templates/${id}`),
    install: (id: string, data?: { name?: string }) =>
      post<Agent>(`/templates/${id}/install`, data),
    publish: (data: {
      agent_id: string;
      name: string;
      description?: string;
      category?: string;
      icon?: string;
      is_public?: boolean;
    }) => post<TemplateDetail>("/templates", data),
  },
  integrations: {
    list: () => get<Integration[]>("/integrations"),
    connect: (provider: string, data: ConnectIntegrationInput) =>
      post<Integration>(`/integrations/${provider}/connect`, data),
    disconnect: (id: string) => del<void>(`/integrations/${id}`),
    available: () => get<AvailableIntegration[]>("/integrations/available"),
    oauthStart: (provider: string) =>
      get<{ url: string }>(`/integrations/${provider}/oauth/start`),
  },
  analytics: {
    overview: () => get<AnalyticsOverview>("/analytics/overview"),
    usage: (params?: Record<string, string>) =>
      get<UsageDataPoint[]>("/analytics/usage", params),
    agentMetrics: (agentId: string) =>
      get<AgentMetrics>(`/analytics/agents/${agentId}`),
    costs: (params?: Record<string, string>) =>
      get<CostBreakdownItem[]>("/analytics/costs", params),
  },
  knowledgeBases: {
    list: (params?: Record<string, string>) =>
      get<PaginatedResponse<KnowledgeBase>>("/knowledge-bases", params),
    get: (id: string) => get<KnowledgeBase>(`/knowledge-bases/${id}`),
    create: (data: CreateKnowledgeBaseInput) =>
      post<KnowledgeBase>("/knowledge-bases", data),
    delete: (id: string) => del<void>(`/knowledge-bases/${id}`),
    documents: (id: string) =>
      get<KBDocument[]>(`/knowledge-bases/${id}/documents`),
    uploadDocument: (id: string, file: File) =>
      uploadFile<DocumentUploadResponse>(`/knowledge-bases/${id}/documents`, file),
    deleteDocument: (kbId: string, docId: string) =>
      del<void>(`/knowledge-bases/${kbId}/documents/${docId}`),
    query: (id: string, query: string, topK?: number) =>
      post<QueryResponse>(`/knowledge-bases/${id}/query`, {
        query,
        top_k: topK ?? 5,
      }),
  },
  org: {
    get: () => get<{ id: string; name: string; slug: string; plan: string; settings: Record<string, unknown>; created_at: string }>("/org"),
    update: (data: { name: string }) => put<{ id: string; name: string; slug: string; plan: string; settings: Record<string, unknown>; created_at: string }>("/org", data),
    members: {
      list: () => get<OrgMember[]>("/org/members"),
      invite: (data: { email: string; role: string }) => post<OrgMember>("/org/members/invite", data),
      updateRole: (memberId: string, role: string) => put<OrgMember>(`/org/members/${memberId}`, { role }),
      remove: (memberId: string) => del<void>(`/org/members/${memberId}`),
    },
    apiKeys: {
      list: () => get<ApiKeyItem[]>("/org/api-keys"),
      create: (data: { name: string }) => post<ApiKeyCreated>("/org/api-keys", data),
      revoke: (keyId: string) => del<void>(`/org/api-keys/${keyId}`),
    },
    aiProviders: {
      list: () => get<{ providers: AIProviderConfig[] }>("/org/ai-providers"),
      set: (provider: string, data: { api_key?: string; base_url?: string }) =>
        put<AIProviderConfig>(`/org/ai-providers/${provider}`, data),
      remove: (provider: string) => del<void>(`/org/ai-providers/${provider}`),
      test: (provider: string, data?: { api_key?: string; base_url?: string }) =>
        post<AIProviderTestResult>(`/org/ai-providers/${provider}/test`, data),
    },
  },
};
