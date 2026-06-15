/**
 * CurioStudio — Content Business Operating System
 * ==================================================
 *
 * Domain-first architecture. Each top-level lib folder maps to a business domain.
 * Routes and UI sections follow the same boundaries — no cross-domain leakage.
 *
 * ┌─────────────┬──────────────────────────────────────────────────────────┐
 * │ Domain      │ Responsibility                                           │
 * ├─────────────┼──────────────────────────────────────────────────────────┤
 * │ /content    │ Projects, scripts, episodes, series numbering             │
 * │ /production │ Pipeline, studio, teleprompter, recording, slides        │
 * │ /discovery  │ Multi-source trending (GitHub, HF, Docker, Kaggle, GL)   │
 * │ /marketing  │ Campaigns, hashtags, repurposing, analytics (manual)     │
 * │ /operations │ Workflow templates, SOPs, checklists, process tracking   │
 * │ /knowledge  │ Help center, in-app docs (DocPage), FAQs, guides         │
 * │ /business   │ Content calendar, showtime, scheduling, content slots    │
 * │ /system     │ Health, settings, LLM routing, connectors, notifications │
 * └─────────────┴──────────────────────────────────────────────────────────┘
 *
 * Data flow (happy path):
 *   discovery → queue → production pipeline → studio → calendar slot → marketing campaign → publish
 *
 * Navigation groups mirror domains:
 *   TODAY (business) | CREATE (discovery+content+production) | GROW (marketing)
 *   OPERATE (operations) | LEARN (knowledge) | SYSTEM
 */

export const DOMAINS = {
  content: "content",
  production: "production",
  discovery: "discovery",
  marketing: "marketing",
  operations: "operations",
  knowledge: "knowledge",
  business: "business",
  system: "system",
} as const;

export type Domain = (typeof DOMAINS)[keyof typeof DOMAINS];
