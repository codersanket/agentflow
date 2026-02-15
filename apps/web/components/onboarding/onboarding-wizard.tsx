"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  Zap,
  Brain,
  Globe,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api, type Template } from "@/lib/api";

interface OnboardingWizardProps {
  onComplete: (agentId: string) => void;
  onSkip: () => void;
}

type WizardPath = "scratch" | "template";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  automation: <Zap className="h-5 w-5" />,
  ai: <Brain className="h-5 w-5" />,
  integration: <Globe className="h-5 w-5" />,
  default: <Sparkles className="h-5 w-5" />,
};

function getCategoryIcon(category?: string): React.ReactNode {
  if (!category) return CATEGORY_ICONS.default;
  const key = category.toLowerCase();
  return CATEGORY_ICONS[key] || CATEGORY_ICONS.default;
}

function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-2 rounded-full transition-all duration-300",
            i === currentStep
              ? "w-8 bg-primary"
              : i < currentStep
                ? "w-2 bg-primary/60"
                : "w-2 bg-muted-foreground/25"
          )}
        />
      ))}
    </div>
  );
}

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [path, setPath] = useState<WizardPath | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [agentName, setAgentName] = useState("");
  const [agentDescription, setAgentDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = path === "template" ? 4 : 3;

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await api.templates.list();
      setTemplates(res.items);
    } catch {
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step === 1 && path === "template" && templates.length === 0) {
      loadTemplates();
    }
  }, [step, path, templates.length, loadTemplates]);

  const handleStartFromScratch = () => {
    setPath("scratch");
    setStep(1);
  };

  const handleUseTemplate = () => {
    setPath("template");
    setStep(1);
  };

  const handleBack = () => {
    if (step === 1) {
      setPath(null);
      setSelectedTemplate(null);
      setStep(0);
    } else if (step === 2 && path === "template") {
      setStep(1);
    }
  };

  const handleNext = () => {
    if (path === "template" && step === 1) {
      if (!selectedTemplate) return;
      setStep(2);
    } else if (
      (path === "scratch" && step === 1) ||
      (path === "template" && step === 2)
    ) {
      if (!agentName.trim()) {
        setError("Please give your agent a name.");
        return;
      }
      setError(null);
      handleCreate();
    }
  };

  const handleCreate = async () => {
    const creatingStep = path === "template" ? 3 : 2;
    setStep(creatingStep);
    setIsCreating(true);
    setError(null);

    try {
      let agent;
      if (path === "template" && selectedTemplate) {
        agent = await api.templates.install(selectedTemplate.id, {
          name: agentName.trim(),
        });
      } else {
        agent = await api.agents.create({
          name: agentName.trim(),
          description: agentDescription.trim() || undefined,
        });
      }

      localStorage.setItem("agentflow_first_agent_created", "true");
      if (path === "template") {
        localStorage.setItem("agentflow_from_template", "true");
      }
      onComplete(agent.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
      setIsCreating(false);
      // Go back to the name step
      const nameStep = path === "template" ? 2 : 1;
      setStep(nameStep);
    }
  };

  const getNameStepIndex = () => (path === "template" ? 2 : 1);
  const getCreatingStepIndex = () => (path === "template" ? 3 : 2);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      {/* Skip button */}
      <div className="absolute right-6 top-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSkip}
          className="text-muted-foreground hover:text-foreground"
        >
          Skip
          <X className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="w-full max-w-[600px] space-y-8">
        {/* Step Indicator */}
        <StepIndicator currentStep={step} totalSteps={totalSteps} />

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="space-y-8 text-center animate-in fade-in duration-500">
            <div className="flex justify-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-12 w-12 text-primary" />
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight">
                Welcome to AgentFlow!
              </h1>
              <p className="text-lg text-muted-foreground">
                Let&apos;s create your first AI agent in under 2 minutes.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                variant="outline"
                onClick={handleStartFromScratch}
                className="w-full sm:w-auto"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Start from Scratch
              </Button>
              <Button
                size="lg"
                onClick={handleUseTemplate}
                className="w-full sm:w-auto"
              >
                <Zap className="mr-2 h-4 w-4" />
                Use a Template
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 1 (template path): Choose Template */}
        {step === 1 && path === "template" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                Choose a Template
              </h2>
              <p className="text-muted-foreground">
                Pick a pre-built agent to get started quickly.
              </p>
            </div>

            {templatesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                <Sparkles className="h-10 w-10 text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">
                  No templates available yet. You can start from scratch instead.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setPath("scratch");
                    setStep(1);
                  }}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Start from Scratch
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      selectedTemplate?.id === template.id
                        ? "border-primary ring-2 ring-primary/20"
                        : "hover:border-primary/40"
                    )}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          {getCategoryIcon(template.category)}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm truncate">
                              {template.name}
                            </h3>
                            {template.category && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {template.category}
                              </Badge>
                            )}
                          </div>
                          {template.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {template.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={!selectedTemplate}
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Name Step (step 1 for scratch, step 2 for template) */}
        {step === getNameStepIndex() && path !== null && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                Name Your Agent
              </h2>
              <p className="text-muted-foreground">
                Give your agent a name so you can easily find it later.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="onboarding-name"
                  className="text-sm font-medium leading-none"
                >
                  What should we call your agent?
                </label>
                <Input
                  id="onboarding-name"
                  placeholder="e.g., Customer Support Bot, Lead Qualifier, Daily Report..."
                  value={agentName}
                  onChange={(e) => {
                    setAgentName(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && agentName.trim()) {
                      handleNext();
                    }
                  }}
                  autoFocus
                  className="text-base h-12"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="onboarding-description"
                  className="text-sm font-medium leading-none"
                >
                  Description{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </label>
                <Textarea
                  id="onboarding-description"
                  placeholder="What will this agent do?"
                  value={agentDescription}
                  onChange={(e) => setAgentDescription(e.target.value)}
                  rows={3}
                  className="text-base"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={!agentName.trim()}
              >
                Create Agent
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Creating Step */}
        {step === getCreatingStepIndex() && isCreating && (
          <div className="space-y-6 text-center animate-in fade-in duration-300">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                Creating your agent...
              </h2>
              <p className="text-muted-foreground">
                {path === "template"
                  ? "Setting up your agent from the template."
                  : "Setting up a fresh agent for you."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
