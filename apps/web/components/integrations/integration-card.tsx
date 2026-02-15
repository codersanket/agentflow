"use client";

import { MessageSquare, Globe, Webhook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AvailableIntegration, Integration } from "@/lib/api";

const PROVIDER_ICONS: Record<string, React.ElementType> = {
  slack: MessageSquare,
  webhook: Webhook,
  http_request: Globe,
};

interface IntegrationCardProps {
  provider: AvailableIntegration;
  connected?: Integration;
  onConnect: (provider: string) => void;
  onDisconnect: (id: string) => void;
}

export function IntegrationCard({
  provider,
  connected,
  onConnect,
  onDisconnect,
}: IntegrationCardProps) {
  const Icon = PROVIDER_ICONS[provider.provider] ?? Globe;
  const isConnected = !!connected;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">
              {isConnected && connected.name ? connected.name : provider.name}
            </CardTitle>
            {isConnected && connected.name && (
              <p className="text-xs text-muted-foreground">{provider.name}</p>
            )}
          </div>
          <Badge variant={isConnected ? "default" : "outline"}>
            {isConnected ? "Connected" : "Available"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <CardDescription>{provider.description}</CardDescription>
        {provider.actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {provider.actions.map((action) => (
              <Badge key={action.name} variant="secondary" className="text-xs">
                {action.name.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        {isConnected ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onDisconnect(connected.id)}
          >
            Disconnect
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full"
            onClick={() => onConnect(provider.provider)}
          >
            Connect
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
