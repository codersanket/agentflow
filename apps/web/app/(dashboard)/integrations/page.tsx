"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IntegrationCard } from "@/components/integrations/integration-card";
import { ConnectDialog } from "@/components/integrations/connect-dialog";
import {
  api,
  type AvailableIntegration,
  type Integration,
} from "@/lib/api";

export default function IntegrationsPage() {
  const [available, setAvailable] = useState<AvailableIntegration[]>([]);
  const [connected, setConnected] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectProvider, setConnectProvider] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [availableRes, connectedRes] = await Promise.all([
        api.integrations.available(),
        api.integrations.list(),
      ]);
      setAvailable(availableRes);
      setConnected(connectedRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load integrations");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for OAuth popup success messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "oauth_success") {
        fetchData();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [fetchData]);

  const handleConnect = async (
    provider: string,
    credentials: Record<string, string>,
    name?: string
  ) => {
    const result = await api.integrations.connect(provider, {
      credentials,
      name,
    });
    setConnected((prev) => [result, ...prev]);
  };

  const handleDisconnect = async (id: string) => {
    await api.integrations.disconnect(id);
    setConnected((prev) => prev.filter((i) => i.id !== id));
  };

  const openConnect = async (provider: string) => {
    // Find the provider info to check auth_method
    const providerInfo = available.find((p) => p.provider === provider);

    if (providerInfo?.auth_method === "oauth") {
      // OAuth flow: get the URL and open in a popup
      try {
        const { url } = await api.integrations.oauthStart(provider);
        const w = 600;
        const h = 700;
        const left = window.screenX + (window.outerWidth - w) / 2;
        const top = window.screenY + (window.outerHeight - h) / 2;
        window.open(
          url,
          `${provider}_oauth`,
          `width=${w},height=${h},left=${left},top=${top},popup=yes`
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : `Failed to start ${provider} OAuth`
        );
      }
    } else {
      // Credentials flow: open the dialog
      setConnectProvider(provider);
      setDialogOpen(true);
    }
  };

  const providerMap = new Map(
    available.map((p) => [p.provider, p])
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Integrations</h2>
        <p className="text-muted-foreground">
          Connect your tools and services to use them in agent workflows.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={fetchData}>
            Retry
          </Button>
        </div>
      ) : available.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
          <Plug className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No integrations available</h3>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            Integration providers will appear here once configured.
          </p>
        </div>
      ) : (
        <>
          {connected.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">
                Connected ({connected.length})
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {connected.map((conn) => {
                  const provider = providerMap.get(conn.provider);
                  if (!provider) return null;
                  return (
                    <IntegrationCard
                      key={conn.id}
                      provider={provider}
                      connected={conn}
                      onConnect={openConnect}
                      onDisconnect={handleDisconnect}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold mb-3">
              Available Integrations
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {available.map((provider) => (
                <IntegrationCard
                  key={provider.provider}
                  provider={provider}
                  onConnect={openConnect}
                  onDisconnect={handleDisconnect}
                />
              ))}
            </div>
          </div>
        </>
      )}

      <ConnectDialog
        provider={connectProvider}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConnect={handleConnect}
      />
    </div>
  );
}
