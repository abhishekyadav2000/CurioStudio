import type { ProductionStep } from "@prisma/client";

export const PIPELINE_STEPS: { id: ProductionStep; label: string; description: string }[] = [
  { id: "IMPORT", label: "Import", description: "Repo URL + screenshots" },
  { id: "SCRIPT", label: "Script", description: "Initial YouTube script" },
  { id: "SLIDES", label: "Slides", description: "Presentation deck" },
  { id: "REFINE", label: "Refine", description: "Script aligned to slides" },
  { id: "RECORD", label: "Record", description: "Teleprompter + checklist" },
  { id: "EDIT", label: "Edit", description: "Canva + thumbnail" },
  { id: "PUBLISH", label: "Publish", description: "YouTube metadata" },
];

export const RECORDING_CHECKLIST = [
  { id: "mic", label: "Microphone tested (Riverside / Meet / Teams)" },
  { id: "camera", label: "Camera + lighting ready" },
  { id: "slides", label: "Presentation rehearsed once" },
  { id: "teleprompter", label: "Teleprompter speed calibrated" },
  { id: "screen", label: "Screen share / demo tab prepared" },
  { id: "water", label: "Water nearby — you're talking 5+ minutes" },
];

export const CANVA_WORKFLOW = `# Canva Post-Production Workflow

1. **Import raw video** from Riverside.fm, Google Meet recording, or Teams export
2. **Create 1920×1080 design** → YouTube Thumbnail template or Video project
3. **Add intro card** — project name + "Tested in Sandbox" badge (use brand colors)
4. **Insert B-roll** — GitHub repo page screenshots from Production Hub
5. **Captions** — Canva auto-caption or upload SRT from Riverside
6. **Thumbnail** — use the generated prompt below; export PNG at 1280×720
7. **Export MP4** — 1080p, upload to YouTube with metadata from Publish step

## Quick Links
- [Canva YouTube Thumbnail](https://www.canva.com/create/youtube-thumbnails/)
- [Canva Video Editor](https://www.canva.com/video-editor/)
`;
