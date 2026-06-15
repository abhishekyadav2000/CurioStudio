"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ProductionStep, ProjectStatus } from "@prisma/client";
import type { PresentationSlide } from "@/lib/content";
import type { ScreenshotRecord } from "@/lib/production/uploads";
import { PIPELINE_STEPS, RECORDING_CHECKLIST, CANVA_WORKFLOW } from "@/lib/production/constants";
import { CopyBlock } from "@/components/copy-block";
import { PremiumConnectors } from "@/components/premium-connectors";
import type { ConnectorContext } from "@/lib/connectors";
import { slidesToMarkdown } from "@/lib/production/slides";
import { StatusSelect } from "@/components/status-select";
import {
  Upload,
  FileText,
  Presentation,
  RefreshCw,
  Mic,
  Palette,
  Youtube,
  Loader2,
  CheckCircle,
  ChevronRight,
  Download,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  CheckSquare,
  Square,
} from "lucide-react";

export interface ProductionHubProps {
  projectId: string;
  projectName: string;
  projectUrl: string;
  status: ProjectStatus;
  workflowStep: ProductionStep;
  screenshots: ScreenshotRecord[];
  recordingChecklist: Record<string, boolean>;
  content: {
    youtubeTitle: string | null;
    hook: string | null;
    script5min: string | null;
    script10min: string | null;
    refinedScript: string | null;
    recordingOutline: string | null;
    description: string | null;
    hashtags: string[];
    thumbnailIdea: string | null;
    thumbnailPrompt: string | null;
    canvaExportNotes: string | null;
    presentationSlides: PresentationSlide[];
  } | null;
  youtubeMetadata: {
    title: string | null;
    description: string | null;
    tags: string[];
    category: string | null;
    scheduledAt: string | null;
    privacyStatus: string | null;
  } | null;
  scheduledPublishAt: string | null;
  score: number | null;
  initialStep?: ProductionStep;
}

export function ProductionHub(props: ProductionHubProps) {
  const router = useRouter();
  const [step, setStep] = useState<ProductionStep>(props.initialStep ?? props.workflowStep);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState(props.screenshots);
  const [slides, setSlides] = useState<PresentationSlide[]>(props.content?.presentationSlides ?? []);
  const [script, setScript] = useState(props.content?.refinedScript ?? props.content?.script5min ?? "");
  const [refinedScript, setRefinedScript] = useState(props.content?.refinedScript ?? "");
  const [checklist, setChecklist] = useState<Record<string, boolean>>(props.recordingChecklist);
  const [thumbnailPrompt, setThumbnailPrompt] = useState(props.content?.thumbnailPrompt ?? "");
  const [thumbnailSvg, setThumbnailSvg] = useState("");
  const [thumbnailImageUrl, setThumbnailImageUrl] = useState("");
  const [publishForm, setPublishForm] = useState({
    title: props.youtubeMetadata?.title ?? props.content?.youtubeTitle ?? "",
    description: props.youtubeMetadata?.description ?? props.content?.description ?? "",
    tags: (props.youtubeMetadata?.tags ?? props.content?.hashtags ?? []).join(", "),
    category: props.youtubeMetadata?.category ?? "28",
    scheduledAt: props.youtubeMetadata?.scheduledAt ?? props.scheduledPublishAt ?? "",
    privacyStatus: props.youtubeMetadata?.privacyStatus ?? "private",
  });
  const [copyBundle, setCopyBundle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const api = useCallback(
    async (path: string, options?: RequestInit) => {
      setError(null);
      const res = await fetch(`/api/projects/${props.projectId}${path}`, options);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      return data;
    },
    [props.projectId]
  );

  async function withLoading(key: string, fn: () => Promise<void>) {
    setLoading(key);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  async function uploadScreenshots(files: FileList | null) {
    if (!files?.length) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    await withLoading("upload", async () => {
      const data = await api("/screenshots", { method: "POST", body: fd });
      setScreenshots(data.screenshots);
    });
  }

  async function regenerateScript() {
    await withLoading("script", async () => {
      const data = await api("/regenerate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeMetadata: true }),
      });
      const c = data.project?.content;
      if (c) {
        setScript(c.refinedScript ?? c.script5min ?? "");
        setPublishForm((p) => ({
          ...p,
          title: c.youtubeTitle ?? p.title,
          description: c.description ?? p.description,
        }));
      }
      setStep("SCRIPT");
    });
  }

  async function generateSlidesAction() {
    await withLoading("slides", async () => {
      const data = await api("/generate-slides", { method: "POST" });
      setSlides(data.slides);
      setStep("SLIDES");
    });
  }

  async function saveSlidesAction() {
    await withLoading("save-slides", async () => {
      await api("/generate-slides", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides }),
      });
    });
  }

  async function refineScriptAction() {
    await withLoading("refine", async () => {
      const data = await api("/refine-script", { method: "POST" });
      setRefinedScript(data.refinedScript);
      setScript(data.refinedScript);
      setStep("REFINE");
    });
  }

  async function saveRefinedScript() {
    await withLoading("save-refine", async () => {
      await api("/refine-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: refinedScript, action: "save" }),
      });
    });
  }

  async function markRecorded() {
    await withLoading("recorded", async () => {
      await fetch(`/api/projects/${props.projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "VIDEO_RECORDED" }),
      });
      setStep("EDIT");
      router.refresh();
    });
  }

  async function generateThumbnail() {
    await withLoading("thumbnail", async () => {
      const data = await api("/generate-thumbnail-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateMetadata: true }),
      });
      setThumbnailPrompt(data.prompt);
      setThumbnailSvg(data.svgPreview ?? "");
      setThumbnailImageUrl(data.imageUrl ?? "");
    });
  }

  async function savePublish() {
    await withLoading("publish", async () => {
      const tags = publishForm.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const data = await api("/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...publishForm,
          tags,
          status: "UPLOADED",
          workflowStep: "PUBLISH",
        }),
      });
      setCopyBundle(data.bundle);
      setStep("PUBLISH");
    });
  }

  async function copyAllForYouTube() {
    const data = await api("/publish");
    setCopyBundle(data.bundle);
    await navigator.clipboard.writeText(data.bundle);
  }

  function updateSlide(index: number, field: keyof PresentationSlide, value: string | number) {
    setSlides((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function toggleCheck(id: string) {
    setChecklist((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const stepIndex = PIPELINE_STEPS.findIndex((s) => s.id === step);

  const connectorContext: ConnectorContext = {
    projectName: props.projectName,
    projectUrl: props.projectUrl,
    hook: props.content?.hook,
    script: script || props.content?.script5min,
    refinedScript: refinedScript || props.content?.refinedScript,
    recordingOutline: props.content?.recordingOutline,
    notebookLmBrief: null,
    slidesMarkdown: slides.length ? slidesToMarkdown(slides) : undefined,
    youtubeTitle: publishForm.title || props.content?.youtubeTitle,
    description: publishForm.description || props.content?.description,
    hashtags: publishForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
    thumbnailPrompt: thumbnailPrompt || props.content?.thumbnailPrompt,
    canvaNotes: props.content?.canvaExportNotes ?? CANVA_WORKFLOW,
    score: props.score,
  };

  const stepConnectors: Record<ProductionStep, ("chatgpt" | "notebooklm" | "riverside" | "canva" | "youtube")[]> = {
    IMPORT: ["chatgpt"],
    SCRIPT: ["chatgpt"],
    SLIDES: ["chatgpt"],
    REFINE: ["chatgpt", "riverside"],
    RECORD: ["riverside"],
    EDIT: ["canva"],
    PUBLISH: ["youtube", "canva"],
  };

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <nav className="flex flex-wrap gap-1 p-2 rounded-xl bg-card border border-border">
        {PIPELINE_STEPS.map((s, i) => {
          const active = s.id === step;
          const done = i < stepIndex;
          return (
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all ${
                active
                  ? "bg-accent text-white"
                  : done
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:bg-card-hover"
              }`}
            >
              {done ? <CheckCircle className="w-3 h-3" /> : <span className="w-4 text-center">{i + 1}</span>}
              {s.label}
            </button>
          );
        })}
      </nav>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {/* Step 1: Import */}
      {step === "IMPORT" && (
        <section className="p-6 rounded-xl bg-card border border-border space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Upload className="w-5 h-5 text-accent" /> Import & Research
          </h3>
          <p className="text-sm text-muted">
            Repo:{" "}
            <a href={props.projectUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              {props.projectName}
            </a>
          </p>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              uploadScreenshots(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-accent/50 transition-colors"
          >
            <ImageIcon className="w-8 h-8 text-muted mx-auto mb-2" />
            <p className="text-sm font-medium">Drop screenshots here or click to upload</p>
            <p className="text-xs text-muted mt-1">PNG, JPG, WebP — stored locally on your Mac</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => uploadScreenshots(e.target.files)}
            />
          </div>
          {screenshots.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {screenshots.map((s) => (
                <div key={s.id} className="rounded-lg overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.path} alt={s.filename} className="w-full h-24 object-cover" />
                  <p className="text-xs p-1 truncate text-muted">{s.filename}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3 flex-wrap">
            <ActionButton loading={loading === "script"} onClick={regenerateScript} icon={RefreshCw}>
              Generate Script from Repo + Screenshots
            </ActionButton>
            <button
              onClick={() => setStep("SCRIPT")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-card-hover text-sm"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <PremiumConnectors
            context={connectorContext}
            projectId={props.projectId}
            tools={stepConnectors.IMPORT}
            compact
          />
        </section>
      )}

      {/* Step 2: Script */}
      {step === "SCRIPT" && (
        <section className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" /> YouTube Script
            </h3>
            <ActionButton loading={loading === "script"} onClick={regenerateScript} icon={RefreshCw} small>
              Regenerate
            </ActionButton>
          </div>
          {props.content?.hook && <p className="text-sm text-accent italic">{props.content.hook}</p>}
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={16}
            className="w-full bg-background border border-border rounded-lg p-4 text-sm font-mono leading-relaxed resize-y"
          />
          <div className="flex gap-3 flex-wrap">
            <ActionButton
              loading={loading === "slides"}
              onClick={generateSlidesAction}
              icon={Presentation}
            >
              Generate Slides from Script
            </ActionButton>
            <Link
              href={`/studio/${props.projectId}?mode=teleprompter`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent text-sm hover:bg-accent/20"
            >
              <Mic className="w-4 h-4" /> Preview Teleprompter
            </Link>
          </div>
          <PremiumConnectors
            context={connectorContext}
            projectId={props.projectId}
            tools={stepConnectors.SCRIPT}
            compact
          />
        </section>
      )}

      {/* Step 3: Slides */}
      {step === "SLIDES" && (
        <section className="p-6 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Presentation className="w-5 h-5 text-accent" /> Slide Deck ({slides.length} slides)
            </h3>
            <div className="flex gap-2">
              <ActionButton loading={loading === "slides"} onClick={generateSlidesAction} icon={RefreshCw} small>
                Regenerate
              </ActionButton>
              <ActionButton loading={loading === "save-slides"} onClick={saveSlidesAction} icon={CheckCircle} small>
                Save
              </ActionButton>
            </div>
          </div>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin pr-2">
            {slides.map((slide, i) => (
              <div key={slide.id} className="p-4 rounded-lg bg-background border border-border space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted">Slide {i + 1}</div>
                <input
                  value={slide.title}
                  onChange={(e) => updateSlide(i, "title", e.target.value)}
                  className="w-full bg-card border border-border rounded px-3 py-2 text-sm font-semibold"
                  placeholder="Slide title"
                />
                <textarea
                  value={slide.body}
                  onChange={(e) => updateSlide(i, "body", e.target.value)}
                  rows={3}
                  className="w-full bg-card border border-border rounded px-3 py-2 text-sm"
                  placeholder="Slide body"
                />
                <textarea
                  value={slide.speakerNotes}
                  onChange={(e) => updateSlide(i, "speakerNotes", e.target.value)}
                  rows={2}
                  className="w-full bg-card border border-border rounded px-3 py-2 text-xs text-muted"
                  placeholder="Speaker notes"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 flex-wrap">
            <a
              href={`/api/projects/${props.projectId}/export?format=slides`}
              download
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-card-hover text-sm"
            >
              <Download className="w-4 h-4" /> Export Markdown
            </a>
            <Link
              href={`/studio/${props.projectId}?mode=present`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-dim"
            >
              <Presentation className="w-4 h-4" /> Present Fullscreen
            </Link>
            <ActionButton loading={loading === "refine"} onClick={refineScriptAction} icon={RefreshCw}>
              Refine Script to Match Slides
            </ActionButton>
          </div>
          <PremiumConnectors
            context={connectorContext}
            projectId={props.projectId}
            tools={stepConnectors.SLIDES}
            compact
          />
        </section>
      )}

      {/* Step 4: Refine */}
      {step === "REFINE" && (
        <section className="p-6 rounded-xl bg-card border border-border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" /> Refined Script + Slides
          </h3>
          <div className="grid lg:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Refined Script</label>
                <ActionButton loading={loading === "refine"} onClick={refineScriptAction} icon={RefreshCw} small>
                  Regenerate
                </ActionButton>
              </div>
              <textarea
                value={refinedScript || script}
                onChange={(e) => setRefinedScript(e.target.value)}
                rows={20}
                className="w-full bg-background border border-border rounded-lg p-4 text-sm font-mono leading-relaxed"
              />
              <ActionButton loading={loading === "save-refine"} onClick={saveRefinedScript} icon={CheckCircle} small>
                Save Script
              </ActionButton>
            </div>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto scrollbar-thin">
              {slides.map((s, i) => (
                <div key={s.id} className="p-3 rounded-lg bg-background border border-border">
                  <p className="text-xs text-accent mb-1">Slide {i + 1}</p>
                  <p className="font-semibold text-sm">{s.title}</p>
                  <p className="text-xs text-muted mt-1 whitespace-pre-wrap">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => setStep("RECORD")}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-dim"
          >
            Ready to Record <ChevronRight className="w-4 h-4" />
          </button>
          <div className="mt-4">
            <PremiumConnectors
              context={connectorContext}
              projectId={props.projectId}
              tools={stepConnectors.REFINE}
              compact
            />
          </div>
        </section>
      )}

      {/* Step 5: Record */}
      {step === "RECORD" && (
        <section className="p-6 rounded-xl bg-card border border-border space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Mic className="w-5 h-5 text-accent" /> Record
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Link
              href={`/studio/${props.projectId}?mode=teleprompter`}
              className="p-6 rounded-xl bg-accent/10 border border-accent/30 hover:border-accent transition-all text-center"
            >
              <Mic className="w-10 h-10 text-accent mx-auto mb-3" />
              <h4 className="font-semibold mb-1">Open Teleprompter</h4>
              <p className="text-xs text-muted">Fullscreen scroll for Riverside.fm, Meet, or Teams</p>
            </Link>
            <Link
              href={`/studio/${props.projectId}?mode=present`}
              className="p-6 rounded-xl bg-card border border-border hover:border-accent/30 transition-all text-center"
            >
              <Presentation className="w-10 h-10 text-muted mx-auto mb-3" />
              <h4 className="font-semibold mb-1">Presentation Mode</h4>
              <p className="text-xs text-muted">Rehearse slides with speaker notes</p>
            </Link>
          </div>
          <div className="p-4 rounded-lg bg-background border border-border">
            <h4 className="text-sm font-medium mb-3">Recording Checklist</h4>
            <ul className="space-y-2">
              {RECORDING_CHECKLIST.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => toggleCheck(item.id)}
                    className="flex items-center gap-2 text-sm text-left w-full hover:text-accent"
                  >
                    {checklist[item.id] ? (
                      <CheckSquare className="w-4 h-4 text-accent shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-muted shrink-0" />
                    )}
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <ActionButton loading={loading === "recorded"} onClick={markRecorded} icon={CheckCircle}>
            Mark Video Recorded
          </ActionButton>
          <PremiumConnectors
            context={connectorContext}
            projectId={props.projectId}
            tools={stepConnectors.RECORD}
            compact
          />
        </section>
      )}

      {/* Step 6: Edit / Post-Production */}
      {step === "EDIT" && (
        <section className="p-6 rounded-xl bg-card border border-border space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Palette className="w-5 h-5 text-accent" /> Post-Production (Canva)
          </h3>
          <div className="p-4 rounded-lg bg-background border border-border text-sm whitespace-pre-wrap text-muted max-h-48 overflow-y-auto">
            {props.content?.canvaExportNotes ?? CANVA_WORKFLOW}
          </div>
          <div className="flex gap-3 flex-wrap">
            <a
              href="https://www.canva.com/video-editor/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-card-hover text-sm"
            >
              <ExternalLink className="w-4 h-4" /> Open Canva Video Editor
            </a>
            <a
              href={`/api/projects/${props.projectId}/export?format=markdown`}
              download
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-card-hover text-sm"
            >
              <Download className="w-4 h-4" /> Download Production Pack
            </a>
          </div>
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-accent" /> Thumbnail Generator
              </h4>
              <ActionButton loading={loading === "thumbnail"} onClick={generateThumbnail} icon={RefreshCw} small>
                Generate Prompt
              </ActionButton>
            </div>
            {thumbnailPrompt && (
              <CopyBlock label="Thumbnail Prompt (for Canva / local image gen)" content={thumbnailPrompt} />
            )}
            {thumbnailSvg && (
              <div className="mt-4 p-4 rounded-lg bg-background border border-border">
                <p className="text-xs text-muted mb-2">SVG Preview (1280×720) — import to Canva</p>
                <div
                  className="rounded overflow-hidden border border-border max-w-md"
                  dangerouslySetInnerHTML={{ __html: thumbnailSvg }}
                />
                <a
                  href={`data:image/svg+xml,${encodeURIComponent(thumbnailSvg)}`}
                  download={`${props.projectName}-thumbnail.svg`}
                  className="inline-flex items-center gap-1 mt-2 text-xs text-accent hover:underline"
                >
                  <Download className="w-3 h-3" /> Download SVG for Canva
                </a>
              </div>
            )}
            {thumbnailImageUrl && (
              <div className="mt-4 p-4 rounded-lg bg-background border border-border">
                <p className="text-xs text-muted mb-2">DALL-E 3 Generated Thumbnail</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbnailImageUrl} alt="Generated thumbnail" className="rounded max-w-md border border-border" />
                <a
                  href={thumbnailImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-accent hover:underline"
                >
                  <ExternalLink className="w-3 h-3" /> Open full image
                </a>
              </div>
            )}
          </div>
          <PremiumConnectors
            context={connectorContext}
            projectId={props.projectId}
            tools={stepConnectors.EDIT}
            compact
          />
          <button
            onClick={() => setStep("PUBLISH")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-dim"
          >
            Continue to Publish <ChevronRight className="w-4 h-4" />
          </button>
        </section>
      )}

      {/* Step 7: Publish */}
      {step === "PUBLISH" && (
        <section className="p-6 rounded-xl bg-card border border-border space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Youtube className="w-5 h-5 text-red-400" /> YouTube Publish Prep
          </h3>
          <div className="grid gap-4">
            <Field label="Title" value={publishForm.title} onChange={(v) => setPublishForm((p) => ({ ...p, title: v }))} />
            <div>
              <label className="text-sm font-medium text-muted block mb-1">Description</label>
              <textarea
                value={publishForm.description}
                onChange={(e) => setPublishForm((p) => ({ ...p, description: e.target.value }))}
                rows={8}
                className="w-full bg-background border border-border rounded-lg p-3 text-sm"
              />
            </div>
            <Field label="Tags (comma-separated)" value={publishForm.tags} onChange={(v) => setPublishForm((p) => ({ ...p, tags: v }))} />
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted block mb-1">Schedule Publish</label>
                <input
                  type="datetime-local"
                  value={publishForm.scheduledAt ? publishForm.scheduledAt.slice(0, 16) : ""}
                  onChange={(e) => setPublishForm((p) => ({ ...p, scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : "" }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted block mb-1">Privacy</label>
                <select
                  value={publishForm.privacyStatus}
                  onChange={(e) => setPublishForm((p) => ({ ...p, privacyStatus: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <ActionButton loading={loading === "publish"} onClick={savePublish} icon={Youtube}>
              Save & Mark Uploaded
            </ActionButton>
            <button
              onClick={copyAllForYouTube}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-card-hover text-sm"
            >
              <Copy className="w-4 h-4" /> Copy All for YouTube
            </button>
            <ActionButton
              loading={loading === "thumbnail"}
              onClick={generateThumbnail}
              icon={RefreshCw}
              small
            >
              Regenerate Metadata
            </ActionButton>
          </div>
          {copyBundle && <CopyBlock label="YouTube Upload Bundle" content={copyBundle} />}
          <PremiumConnectors
            context={connectorContext}
            projectId={props.projectId}
            tools={stepConnectors.PUBLISH}
            compact
          />
          <p className="text-xs text-muted">
            YouTube Data API OAuth available when GOOGLE_CLIENT_ID is set in .env. Manual copy-paste always works.
          </p>
        </section>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-4 border-t border-border">
        <StatusSelect projectId={props.projectId} currentStatus={props.status} />
        {props.score != null && (
          <span className="text-sm text-muted">
            Score: <span className="text-accent font-bold">{props.score}</span>/100
          </span>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  loading,
  icon: Icon,
  small,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-2 rounded-lg bg-accent text-white hover:bg-accent-dim disabled:opacity-50 ${
        small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
      }`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-muted block mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
      />
    </div>
  );
}
