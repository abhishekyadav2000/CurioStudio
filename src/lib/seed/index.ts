import { prisma } from "@/lib/db";

const DEFAULT_WORKFLOW_STEPS = [
  {
    id: "discover",
    title: "Discover",
    estimatedMinutes: 15,
    toolLinks: ["/discover"],
    checklist: ["Browse trending sources", "Pick 1–3 candidates", "Queue for testing"],
  },
  {
    id: "research",
    title: "Research",
    estimatedMinutes: 20,
    toolLinks: ["/projects"],
    checklist: ["Read README", "Check stars & activity", "Note video angle"],
  },
  {
    id: "script",
    title: "Script",
    estimatedMinutes: 30,
    toolLinks: ["/studio"],
    checklist: ["Generate 5min script", "Review hook", "Approve outline"],
  },
  {
    id: "slides",
    title: "Slides",
    estimatedMinutes: 25,
    toolLinks: ["/studio"],
    checklist: ["Generate slide deck", "Add speaker notes", "Export for Canva"],
  },
  {
    id: "record",
    title: "Record",
    estimatedMinutes: 45,
    toolLinks: ["/studio"],
    checklist: ["Open teleprompter", "Riverside checklist", "Mark as recorded"],
  },
  {
    id: "edit",
    title: "Edit",
    estimatedMinutes: 60,
    toolLinks: ["/studio"],
    checklist: ["Thumbnail prompt", "Canva export", "Final cut review"],
  },
  {
    id: "publish",
    title: "Publish",
    estimatedMinutes: 20,
    toolLinks: ["/calendar", "/marketing"],
    checklist: ["YouTube metadata", "Schedule slot", "Cross-post plan"],
  },
  {
    id: "promote",
    title: "Promote",
    estimatedMinutes: 30,
    toolLinks: ["/marketing"],
    checklist: ["LinkedIn post", "Twitter thread", "Newsletter snippet"],
  },
];

const SOPS = [
  {
    slug: "daily-review",
    title: "Daily Review SOP",
    category: "Daily",
    order: 1,
    content: `# Daily Review SOP

## Morning (15 min)
1. Open **Dashboard** → check Today's Showtime
2. Review **Queue** for overnight processing
3. Pick today's recording target (SCRIPT_READY project)

## Midday
1. **Discover** → refresh one source tab
2. Queue top 3 if pipeline is empty
3. Update **Calendar** with publish slots

## Evening (10 min)
1. Mark completed steps in **Workflows**
2. Log manual analytics in **Marketing**
3. Export weekly report on Fridays`,
  },
  {
    slug: "recording-day",
    title: "Recording Day SOP",
    category: "Production",
    order: 2,
    content: `# Recording Day SOP

## Pre-record
- [ ] Script status = SCRIPT_READY
- [ ] Slides generated and reviewed
- [ ] Teleprompter export downloaded
- [ ] Riverside room link ready

## During record
- Use Production Hub → Record step
- Follow refined script + slide order
- Capture B-roll notes in project notes

## Post-record
- Update project status → VIDEO_RECORDED
- Schedule edit slot on calendar
- Create marketing campaign draft`,
  },
  {
    slug: "publish-day",
    title: "Publish Day SOP",
    category: "Production",
    order: 3,
    content: `# Publish Day SOP

## Upload
1. Copy metadata bundle from Studio → Publish
2. Upload to YouTube Studio
3. Set visibility & premiere if scheduled

## Cross-post (same day)
1. Open **Marketing** → campaign for project
2. Post LinkedIn + Twitter from generated copy
3. Update calendar slot → PUBLISHED

## Analytics
1. Add Day-1 views manually in Marketing analytics
2. Note CTR in campaign notes`,
  },
];

const DOC_PAGES = [
  {
    slug: "architecture",
    title: "Architecture Overview",
    category: "System",
    order: 1,
    content: `# Architecture Overview

CurioStudio is organized into **8 domains**:

- **Content** — projects, episodes, series
- **Production** — scan → sandbox → script → studio
- **Discovery** — GitHub, Hugging Face, Docker Hub, Kaggle, GitLab
- **Marketing** — campaigns, hashtags, repurposing
- **Operations** — workflows & SOPs
- **Knowledge** — this docs section + Help Center
- **Business** — calendar & showtime scheduling
- **System** — settings, health, LLM providers

All data lives in local SQLite (\`dev.db\`). Premium connectors bridge to external tools without replacing in-app workflows.`,
  },
  {
    slug: "api-env",
    title: "API & Environment Reference",
    category: "System",
    order: 2,
    content: `# API & Environment Reference

## Key routes
| Route | Purpose |
|-------|---------|
| GET /api/health | DB, Ollama, provider status |
| GET /api/trending?source= | Multi-source discovery |
| GET/POST /api/calendar | Content slots |
| GET/POST /api/workflows | Templates & progress |
| GET /api/search?q= | Global search |

## Environment
- \`DATABASE_URL\` — SQLite path
- \`OLLAMA_BASE_URL\` — local LLM
- \`OPENAI_API_KEY\` / \`ANTHROPIC_API_KEY\` — premium
- \`E2B_API_KEY\` — cloud sandbox`,
  },
  {
    slug: "workflow-pipeline",
    title: "Production Workflow",
    category: "Workflow",
    order: 3,
    content: `# Production Workflow

\`\`\`
Discover → Queue → Scan → Sandbox → Analyze → Script → Studio → Record → Publish → Promote
\`\`\`

Each project tracks \`workflowStep\` (IMPORT…PUBLISH) and optional **ProjectWorkflow** checklist from Operations.

Link calendar slots to projects for showtime visibility on the dashboard.`,
  },
];

const FAQ_DOC = {
  slug: "faq",
  title: "Frequently Asked Questions",
  category: "Help",
  order: 10,
  content: `# FAQ

**Why does localhost stop working?**
Trailing space in folder name, corrupted \`.next\` cache, or stale port 3000. Run \`npm run restart\` in ~/CurioStudio.

**How do I rename the project folder?**
Rename to \`curiostudio\` (no trailing space). Update your terminal cwd.

**Which LLM should I use?**
Ollama for free local; GPT-4o for scripts; Claude for refinement. Settings → per-task overrides.

**How does episode numbering work?**
Auto-increments per series from Settings → series name. Episodes link to projects.

**Keyboard shortcuts?**
\`Cmd+K\` global search · Sidebar toggle in header`,
};

let seeded = false;

export async function ensureSeeded(): Promise<void> {
  if (seeded) return;

  const docCount = await prisma.docPage.count();
  if (docCount === 0) {
    for (const doc of [...DOC_PAGES, FAQ_DOC]) {
      await prisma.docPage.create({ data: doc });
    }
  }

  const sopCount = await prisma.sopDocument.count();
  if (sopCount === 0) {
    for (const sop of SOPS) {
      await prisma.sopDocument.create({ data: sop });
    }
  }

  const wfCount = await prisma.workflowTemplate.count();
  if (wfCount === 0) {
    await prisma.workflowTemplate.create({
      data: {
        name: "Everyday Series Pipeline",
        description: "Discover → Research → Script → Slides → Record → Edit → Publish → Promote",
        steps: JSON.stringify(DEFAULT_WORKFLOW_STEPS),
        isDefault: true,
      },
    });
  }

  const tagCount = await prisma.hashtagSet.count();
  if (tagCount === 0) {
    await prisma.hashtagSet.createMany({
      data: [
        {
          name: "Open Source Default",
          tags: JSON.stringify(["#opensource", "#devtools", "#coding", "#everydayseries"]),
          platform: "YOUTUBE",
        },
        {
          name: "LinkedIn Tech",
          tags: JSON.stringify(["#softwareengineering", "#opensource", "#developer"]),
          platform: "LINKEDIN",
        },
      ],
    });
  }

  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  seeded = true;
}

export { DEFAULT_WORKFLOW_STEPS };
