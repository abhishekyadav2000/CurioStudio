# Insider Tracker Roadmap

Organic evolution toward auto-apply: hunt, gather, decide, then apply.

---

## Phase 1 — Data Freshness, Preferences & Smart Shortlist (Items 1–30)

1. **AppSettings scan interval** — `leadsAutoScanIntervalMinutes` (default 5), configurable 1–60 min
2. **Max job age setting** — `leadsMaxAgeDays` (default 45), reject stale postings at ingest
3. **Last scan timestamp** — `lastLeadsScanAt` persisted and shown in UI
4. **Auto-scan cron endpoint** — `GET /api/leads/cron` for background polling
5. **Client auto-scan on mount** — leads page triggers scan + setInterval on interval setting
6. **Stale lead pruning** — `pruneStaleLeads()` archives by postedAt or 60-day capturedAt fallback
7. **Duplicate removal on scan** — dedupe by normalized company+title key, not just URL
8. **Scan rate limiting** — max 6 scans/minute to prevent abuse
9. **JobPreferences model** — targetRoles, keywords, locations, remoteOnly, excludeCompanies in AppSettings JSON
10. **Preferences modal on first visit** — "What are you looking for?" with role presets
11. **Role presets** — Software Engineer, ML Engineer, DevRel, PM, etc.
12. **Keywords textarea** — free-form skill/keyword input merged into preferences
13. **Resume upload API** — `POST /api/leads/resume` accepts .txt and .pdf
14. **PDF text extraction** — pdf-parse with regex fallback for keyword mining
15. **LLM keyword extraction** — Ollama/OpenAI enriches resume keywords and target roles
16. **Merge resume into preferences** — keywords and roles deduped into JobPreferences
17. **Relevance scoring function** — `scoreLead()` 0–100 based on title, keywords, recency, tier
18. **relevanceScore field on JobLead** — computed on scan and preference change
19. **Rescore on preference update** — all open leads rescored when prefs change
20. **Default sort relevance DESC** — then postedAt DESC in API and UI
21. **Min relevance filter** — slider 0–100 in leads UI
22. **Posted within filter** — 7d / 30d / 45d quick filters
23. **Role type multi-select filter** — filter by target role keywords
24. **Remote only filter** — toggle in filter bar
25. **Source filter** — existing source dropdown retained
26. **Fortune 100 company tier filter** — badge + filter for top companies
27. **Quality gates module** — `src/lib/leads/quality.ts` sanitize, validate, cap per source
28. **HTML sanitization** — strip scripts, event handlers, iframes before DB storage
29. **URL validation** — https-only allowlist, block localhost/private IPs
30. **Quality stats on scan** — "Added N fresh · Pruned M stale · Skipped K low-quality"

---

## Phase 2 — Company Profiles & Contact Discovery (Items 31–50)

31. **Company profile enrichment** — website, description, tech stack from GitHub/web
32. **Careers page intel** — capture careers URL content as JOB_POST intel
33. **GitHub org member contacts** — public org members as LOW confidence contacts
34. **Team page scraping** — /about, /team pages for people extraction
35. **Email extraction from careers** — mailto and plain emails from company pages
36. **Job posting contact parsing** — "Contact:", recruiter names from descriptions
37. **Recruiter email detection** — HIGH confidence for talent/recruit/hr emails in postings
38. **Auto find contacts on enrich** — no separate button required
39. **Contact confidence badges** — HIGH / MEDIUM / LOW in contacts tab
40. **Contact → company roles link** — show open roles count per contact's company
41. **Companies tab fresh-role sort** — default sort by fresh open roles + avg relevance
42. **Fortune 100 badge on companies** — visual indicator for top-tier employers
43. **Top 100 companies shortlist view** — filter companies to Fortune 100 set
44. **Company enrichment queue** — auto-enrich 5 unenriched companies per scan
45. **ATS slug detection** — greenhouse/lever/ashby slugs on company records
46. **LinkedIn search URL fallback** — when careers page unavailable
47. **Contact deduplication** — by email or name+title within company
48. **Hiring manager name extraction** — "reporting to" patterns in job text
49. **Contact source attribution** — job_posting, careers_page, github_org, team_page
50. **Contacts tab company filter** — filter contacts by company dropdown

---

## Phase 3 — Pattern Detection & Hiring Signals (Items 51–70)

51. **Hiring velocity metric** — new roles per company per week
52. **Team expansion signals** — spike in same-team postings
53. **New team detection** — first-time team/department in ATS data
54. **Re-post patterns** — same role re-listed after gap (urgency signal)
55. **Seniority trend analysis** — ratio of senior vs junior postings
56. **Remote policy shifts** — remote → hybrid detection per company
57. **Tech stack drift** — new skills appearing in recent vs older postings
58. **Competitor hiring correlation** — similar roles at peer companies same week
59. **Funding → hiring lag** — correlate intel FUNDING events with job spikes
60. **Product launch → hiring** — PRODUCT intel followed by eng hiring
61. **Seasonal hiring patterns** — Q1/Q3 hiring surges by company
62. **Role family clustering** — group postings into eng/product/design buckets
63. **Smart shortlist algorithm v2** — ML-weighted beyond rule-based scoring
64. **"Heating up" company badge** — 3+ fresh roles in 7 days
65. **"Cooling down" indicator** — no fresh roles in 30+ days
66. **Cross-source dedup intelligence** — same role on LinkedIn + Greenhouse merged
67. **Salary mention extraction** — parse salary ranges where present
68. **Location cluster map** — top hiring cities per company
69. **Weekly digest email** — top 10 new matches summary (optional)
70. **Insider signal score** — composite 0–100 hiring momentum per company

---

## Phase 4 — Outreach & Relationship (Items 71–85)

71. **Outreach draft generation** — LLM personalized email per lead
72. **Contact-specific drafts** — tailor to known recruiter/hiring manager
73. **Subject line A/B variants** — 2–3 subject options per draft
74. **One-click copy draft** — clipboard with subject + body
75. **Mark sent tracking** — DRAFT → SENT status on outreach
76. **Follow-up reminder** — nudge if no reply in 5 days (manual mark)
77. **Email template library** — cold, warm intro, referral ask presets
78. **LinkedIn message draft** — shorter variant for InMail
79. **Calendar meeting link insertion** — Calendly/Cal.com in draft footer
80. **Batch outreach queue** — select multiple leads, generate drafts
81. **Outreach analytics** — sent count, response rate (manual input)
82. **Tone selector** — formal / casual / technical for draft generation
83. **Company intel in draft context** — recent news/products referenced
84. **Role research summary in draft** — "what they want" woven into email
85. **Export outreach to CSV** — for mail merge tools

---

## Phase 5 — Application Assist & Auto-Apply (Items 86–100)

86. **Application checklist per lead** — resume, cover letter, portfolio links
87. **Cover letter generation** — LLM draft tailored to role + resume
88. **Form field detection** — parse common application form fields from URL
89. **Auto-fill browser extension spec** — document field mapping for extension
90. **Greenhouse apply assist** — pre-fill known Greenhouse application fields
91. **Lever apply assist** — pre-fill Lever application forms
92. **Workday apply assist** — handle Workday multi-step flows
93. **Resume version manager** — multiple resume variants per role type
94. **Application status tracking** — APPLIED → INTERVIEW → OFFER pipeline
95. **Screenshot proof of apply** — optional capture on submit
96. **Auto-apply queue** — user-approved roles queued for automated submission
97. **Human-in-the-loop approval gate** — confirm before each auto-apply
98. **Playwright apply runner** — headless browser for supported ATS types
99. **Apply success/failure reporting** — log per attempt with error details
100. **Full auto-apply mode** — score threshold + user prefs → apply without manual scan

---

## Progress Tracking

Mark items complete in the in-app Roadmap tab at `/leads` (Roadmap tab) or via `PATCH /api/leads/roadmap`.

Phase 1 items (1–30) are implemented in the current release.
