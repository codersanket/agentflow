"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useBuilderStore } from "@/stores/builder-store";

interface MissingItem {
  key: string;
  label: string;
  linkLabel: string;
  href: string;
}

export function PreflightBanner() {
  const nodes = useBuilderStore((s) => s.nodes);
  const [missingItems, setMissingItems] = useState<MissingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Determine what the current nodes require
  const requirements = useMemo(() => {
    let needsAI = false;
    let needsSlack = false;
    let needsEmail = false;

    for (const node of nodes) {
      const data = node.data;

      if (data.type === "ai") {
        needsAI = true;
      }

      if (data.type === "action") {
        if (
          data.config.action_type === "slack_send_message" ||
          data.subtype === "slack"
        ) {
          needsSlack = true;
        }
        if (
          data.config.action_type === "send_email" ||
          data.subtype === "email"
        ) {
          needsEmail = true;
        }
      }
    }

    return { needsAI, needsSlack, needsEmail };
  }, [nodes]);

  // Reset dismissed state when nodes change
  useEffect(() => {
    setDismissed(false);
  }, [nodes]);

  // Check configured state against requirements
  useEffect(() => {
    const { needsAI, needsSlack, needsEmail } = requirements;

    // Nothing required — skip API calls
    if (!needsAI && !needsSlack && !needsEmail) {
      setMissingItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function check() {
      setLoading(true);
      try {
        const results = await Promise.all([
          needsAI
            ? api.org.aiProviders.list()
            : Promise.resolve(null),
          needsSlack || needsEmail
            ? api.integrations.list()
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        const [providersResult, integrations] = results;
        const missing: MissingItem[] = [];

        if (needsAI && providersResult) {
          const hasConfigured = providersResult.providers.some(
            (p) => p.is_configured
          );
          if (!hasConfigured) {
            missing.push({
              key: "ai-provider",
              label: "AI Provider not configured",
              linkLabel: "Configure in Settings",
              href: "/settings/ai-providers",
            });
          }
        }

        if (needsSlack && integrations) {
          const hasSlack = integrations.some(
            (i) => i.provider === "slack" && i.status === "connected"
          );
          if (!hasSlack) {
            missing.push({
              key: "slack",
              label: "Slack not connected",
              linkLabel: "Connect Slack",
              href: "/integrations",
            });
          }
        }

        if (needsEmail && integrations) {
          const hasEmail = integrations.some(
            (i) => i.provider === "email" && i.status === "connected"
          );
          if (!hasEmail) {
            missing.push({
              key: "email",
              label: "Email not configured",
              linkLabel: "Configure Email",
              href: "/integrations",
            });
          }
        }

        setMissingItems(missing);
      } catch {
        // On error, silently hide the banner rather than showing stale data
        setMissingItems([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    check();

    return () => {
      cancelled = true;
    };
  }, [requirements]);

  // Don't render while loading or if there's nothing to show
  if (loading || missingItems.length === 0 || dismissed) {
    return null;
  }

  return (
    <div className="mx-4 mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/50">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />

        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Your agent needs these to run:
          </p>
          <ul className="space-y-1">
            {missingItems.map((item) => (
              <li key={item.key} className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                <span className="text-amber-500 dark:text-amber-500">&bull;</span>
                <span>{item.label}</span>
                <span className="text-amber-400 dark:text-amber-600">&rarr;</span>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-sm font-medium text-amber-800 underline-offset-2 hover:text-amber-900 dark:text-amber-200 dark:hover:text-amber-100"
                  asChild
                >
                  <Link href={item.href}>
                    {item.linkLabel}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded p-1 text-amber-600 transition-colors hover:bg-amber-100 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-900 dark:hover:text-amber-200"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
