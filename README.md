# CurioStudio

> **Test open-source projects safely. Understand them faster. Turn them into content.**

Your **content business operating system** for the **Everyday Series** — discover trending repos across 5 sources, test in isolated sandboxes, produce with hybrid AI, schedule on a content calendar, promote via marketing hub, and run repeatable SOPs.

## Quick start (3 commands)

```bash
npm run install:mac    # once — migrates to ~/CurioStudio, builds, opens browser
npm run start          # daily — production server (fast, stable)
npm run restart        # if broken — kills ports 3000/3001, rebuilds if needed
```

**Canonical install path:** `~/CurioStudio` (no trailing spaces — avoids `.next` corruption).

Or double-click **CurioStudio.command** on your Desktop.

Open **http://localhost:3000** · Health: **http://localhost:3000/api/health**

Use `npm run dev` only when actively editing code.

---

## Architecture (Domain Modules)

CurioStudio is organized into **8 first-class domains** under `src/lib/`:

| Domain | Path | Responsibility |
|--------|------|----------------|
| **Content** | `content/` | Projects, episodes, series numbering |
| **Production** | `production/` | Pipeline, studio, teleprompter, recording |
| **Discovery** | `discovery/` | GitHub, Hugging Face, Docker Hub, Kaggle, GitLab |
| **Marketing** | `marketing/` | Campaigns, hashtags, repurposing, analytics |
| **Operations** | `seed/`, workflows API | Workflow templates, SOPs, checklists |
| **Knowledge** | docs/help APIs | Help center, in-app knowledge base |
| **Business** | `business/` | Content calendar, showtime, scheduling |
| **System** | `system/`, `llm/` | Health, settings, LLM, notifications |

See `src/lib/architecture.ts` for the canonical domain map and data-flow comments.

## Navigation

```
TODAY          CREATE           GROW              OPERATE        LEARN           SYSTEM
Dashboard      Discover         Marketing         Workflows      Help Center     Settings
Calendar       Projects         Analytics         Processes      Docs
Queue          Studio
```

**Sidebar:** collapsible (240px ↔ 64px icons + labels), persisted in `localStorage`, mobile drawer. Collapsed mode shows always-visible **Expand** button, edge strip, tooltips, and abbreviated labels. **Global search:** `Cmd+K`.

## Stability

| Issue | Fix |
|-------|-----|
| Slow / flaky locally | Use `npm run start` (production), not `npm run dev` |
| Port 3000 in use | `npm run restart` |
| ENOENT in `.next` | `npm run restart` or `npm run start:prod` (full rebuild) |
| Trailing-space folder | `npm run install:mac` migrates to `~/CurioStudio` |
| Server offline banner | Run `npm run restart` in `~/CurioStudio` |

## Daily Workflow (hybrid — local + premium)

```
1. Today → "Start Today's Video" OR Discover → Queue Top 3
2. Queue auto-processes: scan → sandbox → analyze → script (hybrid LLM)
3. Production Hub opens when script is ready
4. Import: upload screenshots + NotebookLM brief export
5. Script: Ollama / GPT-4o / Claude — or "Open in ChatGPT" bridge
6. Slides: 8-12 slides with speaker notes
7. Refine: Claude-aligned script + Riverside teleprompter export
8. Record: teleprompter + Riverside checklist
9. Edit: Canva workflow + DALL-E 3 thumbnail (if OpenAI key) + SVG download
10. Publish: metadata bundle → Copy All → YouTube Studio deep link
```

## Hybrid LLM Strategy

### When to use local vs premium

| Task | Best local (Ollama) | Best premium | Auto routing |
|------|---------------------|--------------|--------------|
| Scripts | `llama3.3`, `deepseek-r1` | GPT-4o | OpenAI → Claude → Ollama |
| Slides | `qwen2.5:14b`, `mistral-large` | Claude Sonnet | Claude → OpenAI → Ollama |
| Refine | `llama3.3` | Claude Sonnet | Claude → OpenAI → Ollama |
| Thumbnails | Template + prompt | DALL-E 3 + GPT-4o-mini | OpenAI → Claude → Ollama |
| Screenshots | `llava`, `bakllava` | GPT-4o vision / Claude | Premium → Ollama vision |

Settings → **LLM Providers** to override per task.

### Ollama setup (free, private)

```bash
brew install ollama
ollama serve
ollama pull llama3.3      # scripts
ollama pull qwen2.5:14b   # slides
ollama pull llava         # screenshot vision
```

### Premium API keys (.env)

```bash
OPENAI_API_KEY=sk-...          # GPT-4o scripts, DALL-E 3 thumbnails
ANTHROPIC_API_KEY=sk-ant-...   # Claude Sonnet refinement
```

## Premium Connectors (bridges, not replacements)

| Tool | In-app action |
|------|---------------|
| **ChatGPT** | Copy formatted prompt + repo context; optional OpenAI API direct |
| **NotebookLM** | Download `.md` brief + open notebooklm.google.com |
| **Riverside.fm** | Teleprompter `.txt` + checklist + dashboard link |
| **Canva** | Post-prod notes + production pack + thumbnail SVG download |
| **YouTube** | Full metadata bundle + Studio upload deep link |

Available in **Production Hub** step panels under "Premium Connectors".

## Navigation (detail)

- **Today** (`/`) — Showtime widget, calendar mini, pipeline stats, weekly report export
- **Calendar** (`/calendar`) — Month/week/list views, batch schedule Mon–Fri
- **Discover** (`/discover`) — 5-source tabs: GitHub | HF | Docker | Kaggle | GitLab
- **Projects** (`/projects`) — Tags, batch calendar scheduling
- **Studio** (`/studio/[id]`) — Full 7-step pipeline + premium bridges
- **Marketing** (`/marketing`) — Campaigns, repurposing, manual analytics
- **Workflows** (`/workflows`) — 8-step pipeline templates + per-project progress
- **Processes** (`/processes`) — Editable SOP library
- **Help** (`/help`) — FAQ, guides, shortcuts
- **Docs** (`/docs`) — In-app knowledge base (editable markdown in DB)
- **Settings** (`/settings`) — System status, LLM providers, health watchdog

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `file:./dev.db` | SQLite database |
| `SCRIPT_PROVIDER` | `auto` | Script LLM routing |
| `SLIDE_PROVIDER` | `auto` | Slide LLM routing |
| `REFINE_PROVIDER` | `auto` | Refine LLM routing |
| `THUMBNAIL_PROVIDER` | `auto` | Thumbnail/metadata routing |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Local Ollama server |
| `OLLAMA_MODEL` | `llama3.3` | Default text model |
| `OLLAMA_VISION_MODEL` | `llava` | Screenshot analysis |
| `OPENAI_API_KEY` | — | GPT-4o, DALL-E 3 |
| `OPENAI_SCRIPT_MODEL` | `gpt-4o` | Scripts & slides |
| `OPENAI_QUICK_MODEL` | `gpt-4o-mini` | Metadata & quick tasks |
| `ANTHROPIC_API_KEY` | — | Claude Sonnet |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Refinement model |
| `E2B_API_KEY` | — | Real cloud sandbox |
| `GITHUB_TOKEN` | — | Higher API rate limits |
| `GOOGLE_CLIENT_ID` | — | YouTube OAuth (optional) |
| `PORT` | `3000` | Server port |

## API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/health` | System health (db, ollama, port, providers) |
| POST | `/api/projects/[id]/screenshots` | Upload images locally |
| POST | `/api/projects/[id]/generate-slides` | Generate slide deck |
| POST | `/api/projects/[id]/refine-script` | Align script to slides |
| POST | `/api/projects/[id]/generate-thumbnail-prompt` | Thumbnail + DALL-E |
| PATCH | `/api/projects/[id]/publish` | YouTube metadata + schedule |

## Safety Policy

Unknown code never touches your Mac. Every project runs in a disposable cloud sandbox (or simulation). Uploads stored in `public/uploads/`.

## Tech Stack

Next.js 15 · Prisma/SQLite · E2B · Ollama · OpenAI · Anthropic Claude · Tailwind CSS 4
