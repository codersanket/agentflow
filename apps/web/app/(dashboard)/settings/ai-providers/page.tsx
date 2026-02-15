"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Brain,
  Zap,
  Sparkles,
  Server,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api, type AIProviderConfig, type AIProviderTestResult } from "@/lib/api";

interface ProviderMeta {
  key: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  models: string;
  hint: string;
  isLocal?: boolean;
  defaultBaseUrl?: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    key: "openai",
    name: "OpenAI",
    description: "GPT-4o, GPT-4, GPT-3.5 and more",
    icon: Zap,
    models: "gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo",
    hint: "Get your API key from platform.openai.com",
  },
  {
    key: "anthropic",
    name: "Anthropic",
    description: "Claude 4.5, Claude 3.5 Sonnet and more",
    icon: Brain,
    models: "claude-4.5-sonnet, claude-3.5-sonnet, claude-3-haiku",
    hint: "Get your API key from console.anthropic.com",
  },
  {
    key: "google",
    name: "Google AI",
    description: "Gemini Pro, Gemini Flash and more",
    icon: Sparkles,
    models: "gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash",
    hint: "Get your API key from aistudio.google.com",
  },
  {
    key: "ollama",
    name: "Ollama",
    description: "Run open-source models locally (Llama, Mistral, etc.)",
    icon: Server,
    models: "llama3, mistral, codellama, phi3",
    hint: "Make sure Ollama is running locally",
    isLocal: true,
    defaultBaseUrl: "http://localhost:11434",
  },
];

interface ProviderState {
  apiKey: string;
  baseUrl: string;
  showKey: boolean;
  editing: boolean;
  testing: boolean;
  testResult: AIProviderTestResult | null;
  removing: boolean;
  confirmRemove: boolean;
  saving: boolean;
}

function initialProviderState(meta: ProviderMeta): ProviderState {
  return {
    apiKey: "",
    baseUrl: meta.defaultBaseUrl || "",
    showKey: false,
    editing: false,
    testing: false,
    testResult: null,
    removing: false,
    confirmRemove: false,
    saving: false,
  };
}

export default function AIProvidersPage() {
  const [configs, setConfigs] = useState<Record<string, AIProviderConfig>>({});
  const [states, setStates] = useState<Record<string, ProviderState>>(() => {
    const initial: Record<string, ProviderState> = {};
    for (const p of PROVIDERS) {
      initial[p.key] = initialProviderState(p);
    }
    return initial;
  });
  const [loading, setLoading] = useState(true);

  const fetchProviders = useCallback(async () => {
    try {
      const data = await api.org.aiProviders.list();
      const map: Record<string, AIProviderConfig> = {};
      for (const p of data.providers) {
        map[p.provider] = p;
      }
      setConfigs(map);
    } catch {
      // API may not be available yet, silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  function updateState(provider: string, patch: Partial<ProviderState>) {
    setStates((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], ...patch },
    }));
  }

  async function handleSave(meta: ProviderMeta) {
    const state = states[meta.key];
    updateState(meta.key, { saving: true, testResult: null });

    try {
      const payload: { api_key?: string; base_url?: string } = {};
      if (meta.isLocal) {
        payload.base_url = state.baseUrl || meta.defaultBaseUrl;
      } else {
        payload.api_key = state.apiKey;
      }

      await api.org.aiProviders.set(meta.key, payload);
      await fetchProviders();
      updateState(meta.key, {
        editing: false,
        saving: false,
        apiKey: "",
        showKey: false,
      });
    } catch {
      updateState(meta.key, {
        saving: false,
        testResult: {
          success: false,
          message: "Failed to save provider configuration.",
          model_used: null,
        },
      });
    }
  }

  async function handleTest(meta: ProviderMeta) {
    updateState(meta.key, { testing: true, testResult: null });

    try {
      const result = await api.org.aiProviders.test(meta.key);
      updateState(meta.key, { testing: false, testResult: result });
    } catch {
      updateState(meta.key, {
        testing: false,
        testResult: {
          success: false,
          message: "Connection test failed. Check your configuration.",
          model_used: null,
        },
      });
    }
  }

  async function handleRemove(meta: ProviderMeta) {
    updateState(meta.key, { removing: true });

    try {
      await api.org.aiProviders.remove(meta.key);
      await fetchProviders();
      updateState(meta.key, {
        ...initialProviderState(meta),
      });
    } catch {
      updateState(meta.key, {
        removing: false,
        confirmRemove: false,
        testResult: {
          success: false,
          message: "Failed to remove provider.",
          model_used: null,
        },
      });
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">AI Providers</h3>
          <p className="text-sm text-muted-foreground">
            Connect your AI model providers to power your agents.
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">AI Providers</h3>
        <p className="text-sm text-muted-foreground">
          Connect your AI model providers to power your agents.
        </p>
      </div>

      <div className="grid gap-6">
        {PROVIDERS.map((meta) => {
          const config = configs[meta.key];
          const state = states[meta.key];
          const isConfigured = config?.is_configured ?? false;
          const Icon = meta.icon;

          return (
            <Card key={meta.key}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {meta.name}
                        {isConfigured ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                            Connected
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
                            Not configured
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{meta.description}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Models list */}
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Models:</span> {meta.models}
                </div>

                {/* Not configured: show "Add" button or input form */}
                {!isConfigured && !state.editing && (
                  <Button
                    variant="outline"
                    onClick={() => updateState(meta.key, { editing: true, testResult: null })}
                  >
                    {meta.isLocal ? "Configure Base URL" : "Add API Key"}
                  </Button>
                )}

                {/* Editing form (new key / new base URL) */}
                {!isConfigured && state.editing && (
                  <div className="space-y-3 rounded-lg border p-4">
                    {meta.isLocal ? (
                      <div className="space-y-2">
                        <Label htmlFor={`base-url-${meta.key}`}>Base URL</Label>
                        <Input
                          id={`base-url-${meta.key}`}
                          type="text"
                          placeholder={meta.defaultBaseUrl}
                          value={state.baseUrl}
                          onChange={(e) =>
                            updateState(meta.key, { baseUrl: e.target.value })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          {meta.hint}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor={`api-key-${meta.key}`}>API Key</Label>
                        <div className="relative">
                          <Input
                            id={`api-key-${meta.key}`}
                            type={state.showKey ? "text" : "password"}
                            placeholder="Enter your API key..."
                            value={state.apiKey}
                            onChange={(e) =>
                              updateState(meta.key, { apiKey: e.target.value })
                            }
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateState(meta.key, { showKey: !state.showKey })
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {state.showKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {meta.hint}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleSave(meta)}
                        disabled={
                          state.saving ||
                          (!meta.isLocal && !state.apiKey.trim()) ||
                          (meta.isLocal && !state.baseUrl.trim())
                        }
                      >
                        {state.saving && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          updateState(meta.key, {
                            editing: false,
                            apiKey: "",
                            baseUrl: meta.defaultBaseUrl || "",
                            testResult: null,
                          })
                        }
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Configured: show masked key + actions */}
                {isConfigured && (
                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        {meta.isLocal ? (
                          <>
                            <Label className="text-xs text-muted-foreground">Base URL</Label>
                            <p className="text-sm font-mono">
                              {config.base_url || meta.defaultBaseUrl}
                            </p>
                          </>
                        ) : (
                          <>
                            <Label className="text-xs text-muted-foreground">API Key</Label>
                            <p className="text-sm font-mono">
                              {config.api_key || "sk-...****"}
                            </p>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTest(meta)}
                          disabled={state.testing}
                        >
                          {state.testing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="mr-2 h-4 w-4" />
                          )}
                          Test Connection
                        </Button>

                        {!state.confirmRemove ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateState(meta.key, { confirmRemove: true })
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              Are you sure?
                            </span>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemove(meta)}
                              disabled={state.removing}
                            >
                              {state.removing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              Confirm
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                updateState(meta.key, { confirmRemove: false })
                              }
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Test result feedback */}
                {state.testResult && (
                  <div
                    className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
                      state.testResult.success
                        ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                        : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                    }`}
                  >
                    {state.testResult.success ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <div>
                      <p>{state.testResult.message}</p>
                      {state.testResult.model_used && (
                        <p className="mt-1 text-xs opacity-75">
                          Tested with: {state.testResult.model_used}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
