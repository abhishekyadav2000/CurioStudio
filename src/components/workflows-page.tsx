"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/page-header";

interface WorkflowStep {
  id: string;
  title: string;
  estimatedMinutes: number;
  toolLinks: string[];
  checklist: string[];
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  steps: string;
  isDefault: boolean;
}

interface ProjectWorkflow {
  id: string;
  projectId: string;
  currentStep: number;
  stepProgress: string;
  template: Template | null;
  project: { id: string; name: string | null; status: string };
}

export function WorkflowsPageClient() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [projectWorkflows, setProjectWorkflows] = useState<ProjectWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  async function load() {
    const res = await fetch("/api/workflows");
    const data = await res.json();
    setTemplates(data.templates ?? []);
    setProjectWorkflows(data.projectWorkflows ?? []);
    const def = (data.templates ?? []).find((t: Template) => t.isDefault) ?? data.templates?.[0];
    setSelectedTemplate(def ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const steps: WorkflowStep[] = selectedTemplate
    ? JSON.parse(selectedTemplate.steps)
    : [];

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-8">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Workflows" }]} />
      <PageHeader
        title="Business Workflows"
        description="8-step pipeline from discover to promote — track per project"
        helpHref="/docs/workflow-pipeline"
      />

      {loading ? (
        <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
      ) : (
        <>
          <div className="mb-6 flex gap-2 flex-wrap">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t)}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  selectedTemplate?.id === t.id ? "bg-accent/10 border-accent/30 text-accent" : "border-border hover:bg-card-hover"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          {selectedTemplate && (
            <div className="mb-8">
              <p className="text-sm text-muted mb-4">{selectedTemplate.description}</p>
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div key={step.id} className="p-4 rounded-xl bg-card border border-border">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-mono">
                            {i + 1}
                          </span>
                          <h3 className="font-semibold">{step.title}</h3>
                          <span className="text-xs text-muted">~{step.estimatedMinutes} min</span>
                        </div>
                        <ul className="space-y-1 ml-8">
                          {step.checklist.map((item) => (
                            <li key={item} className="text-sm text-muted flex items-center gap-2">
                              <Circle className="w-3 h-3 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {step.toolLinks.map((link) => (
                          <Link
                            key={link}
                            href={link}
                            className="text-xs text-accent flex items-center gap-1 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {link.replace("/", "") || "home"}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3 className="text-lg font-semibold mb-3">Per-project progress</h3>
          {projectWorkflows.length === 0 ? (
            <p className="text-sm text-muted p-4 rounded-xl border border-dashed border-border">
              Assign a workflow from a project page, or it auto-creates when you queue from Discover.
            </p>
          ) : (
            <div className="space-y-2">
              {projectWorkflows.map((pw) => {
                const tplSteps: WorkflowStep[] = pw.template ? JSON.parse(pw.template.steps) : [];
                const progress = JSON.parse(pw.stepProgress || "{}") as Record<string, { completed?: string[] }>;
                const current = tplSteps[pw.currentStep];
                return (
                  <Link
                    key={pw.id}
                    href={`/projects/${pw.projectId}`}
                    className="block p-4 rounded-xl bg-card border border-border hover:border-accent/20"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{pw.project.name}</span>
                      <span className="text-xs text-muted">Step {pw.currentStep + 1}/{tplSteps.length}</span>
                    </div>
                    {current && (
                      <p className="text-sm text-muted mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-accent" />
                        {current.title}
                        {(progress[current.id]?.completed?.length ?? 0) > 0 &&
                          ` · ${progress[current.id].completed!.length}/${current.checklist.length} done`}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
