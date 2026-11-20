# Tilth — Deep Product Research: Executive Summary & Phase Map

This research assignment is complete. All nine phases were executed and all nine
deliverables are produced below. No code was implemented (per research rule #14);
this is analysis and product strategy only.

---

## Phase → Deliverable map

| Phase                        | What was done                                                                                                                                                                                                                                             | Deliverable                                            | File                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| 1 — Tilth's Actual Baseline  | Inspected the real codebase (store.ts, types.ts, quickAdd.ts, tasks/habits/focus/index routes, AGENTS.md contract). Verified local-first IndexedDB, schema v5, Arabic-first RTL, pure engines, single `applyRewardEvent` wiring, PWA/workerd constraints. | Baseline findings (incorporated into all deliverables) | `09-evidence-research-register.md` (B1–B20)                               |
| 2 — Competitive Landscape    | Studied 20 products across task mgmt, all-in-one, daily planning, habits/focus. Collected strengths, weaknesses, positioning, pricing, UX decisions via official docs, reviews, comparisons (2025–2026 where available).                                  | Market and Competitor Intelligence                     | `01-market-competitor-intelligence.md`                                    |
| 3 — Voice of Customer        | Collected user love/hate/abandonment/feature-requests from Reddit, App Store, Google Play, support forums, comparison articles. Distinguished first-hand evidence from vendor marketing; no fabricated quotes.                                            | User Sentiment Report                                  | `02-user-sentiment-report.md`                                             |
| 4 — Jobs To Be Done          | Organized findings around the Capture → Organize → Prioritize → Plan → Execute → Review → Improve journey (15 jobs investigated).                                                                                                                         | Integrated into blueprint & catalog                    | `06-ideal-product-blueprint.md`, `04-feature-opportunity-catalog.md`      |
| 5 — Feature Opportunities    | Explored intelligent planning, advanced tasks, notes, habit intelligence, focus, analytics, AI automation, and differentiated capabilities. Each scored for impact/complexity/risk.                                                                       | Feature Opportunity Catalog                            | `04-feature-opportunity-catalog.md`                                       |
| 6 — UX / UI / Performance    | Defined measurable acceptance criteria for startup, capture, completion, navigation, search, animations, offline, sync, mobile. Measured baseline from actual CI (421 tests, typecheck 0 errors, lint 0 errors).                                          | Performance and UX Standards                           | `08-performance-ux-standards.md`                                          |
| 7 — Synthesis                | Converted evidence into scored opportunities (Must-have / High-value / Innovative / Low-priority), with competitors, gaps, Tilth advantage, confidence.                                                                                                   | (inside Deliverables 4 & 5)                            | `04-feature-opportunity-catalog.md`, `05-innovative-feature-proposals.md` |
| 8 — Ideal Product Experience | Defined product vision, navigation, dashboard, daily workflow, module relationships, what's immediately accessible vs hidden, what works automatically vs never, what Tilth refuses to become.                                                            | Ideal Tilth Product Blueprint                          | `06-ideal-product-blueprint.md`                                           |
| 9 — Final Deliverables       | All nine outputs produced, including a traceable Evidence and Research Register (~60 sources with URLs, dates, source type, findings, reliability).                                                                                                       | All nine                                               | `docs/research/`                                                          |

---

## Headline conclusions

1. **Tilth's baseline is strong and differentiated.** Local-first IndexedDB, instant quick-add (`!flags`/`#tags`), timestamp-correct focus timer (survives background/reload — beats TickTick's background Pomodoro bug), kanban+list+saved views, habits with skip-limit recovery, no subscription, Arabic-first RTL. These directly answer the top reasons users abandon other apps.

2. **The top abandonment reasons are avoidable without new systems:** complexity/"setup trap" (Notion, ClickUp, Amazing Marvin), slowness (Notion startup), subscription fatigue ($390/yr toolkit), opaque/invasive automation (Motion), gamification decay (Habitica), platform lock-in, core-loop bugs. Tilth's existing architecture (pure engines, single wiring point, debounced writes, soft-delete+undo, optional encrypted sync) already guards against most of these.

3. **Don't build what users reject.** Heavy NLP parsing, AI auto-rescheduling of calendars, team collaboration, location reminders, weekly-count habits, and native apps are explicitly deferred — either low evidence, high complexity, or contradict the optional/explainable automation principle.

4. **The best near-term opportunities are low-complexity:** extend quick-add aliases, global ⌘K capture, surface task notes, improve saved-view discoverability, a "done today" celebratory strip, streak-freeze discoverability, weekly review digest, focus distraction review. Most are already partially in code.

5. **Innovative bets should be prototyped and validated first:** energy-aware plan suggestions, recovery day after missed days, focus→task bridge, note-to-task extraction, weekly time-allocation, habit templates, done list, local weekly summary. Each is labeled a hypothesis with a concrete cheap validation method.

---

## Verification status (baseline, still valid — no code changed)

- Tests: 421 passed / 38 files (`npx vitest run`, 96.54s)
- Typecheck: 0 errors (`tsc --noEmit`)
- Lint: 0 errors, 1 warning (`eslint .`)
- workerd SSR smoke gate: requires 200 on `/` and `/settings` (CI; not re-run here, no code changed)

All files are in `C:\Users\moham\tilth/docs/research/` (00–09). Nothing was committed; the working tree contains only the new markdown research docs.
