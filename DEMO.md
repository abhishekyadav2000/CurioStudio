# CurioStudio — 2-Minute Producer Walkthrough

**Prep:** `npm run dev` → open [http://localhost:3000](http://localhost:3000)

---

## 0:00 — Today (Dashboard)

1. Land on **Dashboard** (`/`).
2. Point out **Showtime** widget (today's scheduled video) and the gradient **Start Today's Video** CTA.
3. Glance at **Trending Now** preview and quick stats (queue, ready to record).

> *"One app from trending repo to published video — this is today's command center."*

---

## 0:25 — Discover → Queue Top 3

1. Sidebar → **Discover** (or click **Discover Trending** card).
2. Confirm **GitHub** tab is selected (default).
3. Click **Queue Top 3** — sends top trending repos to the pipeline.
4. Optional: show **View on GitHub ↗** link and multi-source tabs (Hugging Face, Docker, etc.).

> *"We pull trending repos, score them, and queue the best candidates automatically."*

---

## 0:50 — Studio → Teleprompter

1. If a project is **SCRIPT_READY**: click **Start Today's Video** or sidebar → **Studio** → pick a project.
2. Otherwise: open any project from **All Projects** once queue completes, or use a seeded project.
3. In **Production Hub**, walk through steps; highlight **Open Teleprompter** / **Preview Teleprompter**.
4. Open teleprompter (`?mode=teleprompter`) — scrollable script, recording-ready layout.

> *"Full production pipeline: import, script, slides, record — teleprompter built in."*

---

## 1:15 — Premium Connectors

1. Still in Studio, scroll to **Premium Connectors** on any step (Script, Record, Publish).
2. Show one-click bridges: **ChatGPT**, **Riverside**, **Canva**, **NotebookLM**, **YouTube**.
3. Optional: **Settings** → connector toggles for API keys.

> *"We don't replace your tools — we bridge to them with context from this project."*

---

## 1:35 — Calendar & Marketing (Business OS)

1. Sidebar → **Calendar** — content slots, week view, schedule publish dates.
2. Sidebar → **Marketing** — campaigns, hashtag sets, **1 video → 5 posts** repurposing.
3. Optional: **Workflows** — checklist templates tied to projects.

> *"Beyond recording: calendar, marketing pack, and SOP workflows in one Business OS."*

---

## 1:55 — Close

1. **Help Center** — FAQs, shortcuts, Premium Connectors guide.
2. Collapse sidebar (chevron) to show compact icon mode.
3. **⌘K** global search — projects, calendar, docs.

> *"CurioStudio: discover safely, produce fast, grow the channel."*

---

## Demo fallback tips

| If this happens… | Do this… |
|------------------|----------|
| Queue empty / slow | Use **Import** on dashboard with a GitHub URL |
| No SCRIPT_READY project | Open **Queue**, click **Process All**, wait ~30s |
| LLM offline | Ollama/local fallback or show UI without generating |
| Trending stale | **Refresh** on Discover page |

## Key URLs

| Route | Purpose |
|-------|---------|
| `/` | Dashboard + Start Today's Video |
| `/discover` | GitHub trending, Queue Top 3 |
| `/queue` | Pipeline jobs |
| `/studio/[id]` | Production hub + teleprompter |
| `/calendar` | Content calendar |
| `/marketing` | Campaigns & repurposing |
| `/workflows` | Project checklists |
| `/settings` | LLM + premium connectors |
| `/help` | Help center |
