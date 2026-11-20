# Tilth — Prioritized Roadmap (Deliverable E)

Phased from the opportunity matrix (`docs/strategy/12-opportunity-matrix.md`),
the product experience (`docs/strategy/13-product-experience.md`), and the
current-state audit (`docs/strategy/11-current-state-audit.md`). Priorities:
P0 Foundation, P1 Execution, P2 Intelligence, P3 Personalization.

Nothing here is speculative: each phase lists scope, expected outcome,
dependencies, acceptance criteria, and risks. Acceptance criteria reference the
measurable standards in `docs/research/08-performance-ux-standards.md`.

---

## Phase 0 — Foundation and measurement

**Scope (P0):**

- Establish CI measurement gates: bundle-size budget on the index chunk,
  Lighthouse (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1) on the built app, and an
  axe-core accessibility scan. These are currently absent — the audit flags
  them as measurement gaps, not proven defects.
- Capture baseline runtime timing (startup, task creation, task completion,
  navigation, search) via real measurement on the published build; convert the
  proposed acceptance criteria in `docs/research/08-performance-ux-standards.md`
  into verified numbers or revise them.
- Keep the existing quality gates green: `tsc --noEmit`, `vitest run`,
  `eslint`, workerd smoke (200 on `/`, `/settings`, `/sw.js`,
  `/manifest.webmanifest`, `/_shell.html`).

**Expected outcome:** Regressions become visible in CI before they reach users;
performance claims are backed by measurement, not estimates.

**Dependencies:** None. Can run in parallel with product work.

**Acceptance criteria:**

- CI blocks on lint errors (already restored), typecheck, tests, and workerd
  smoke.
- Bundle budget + Lighthouse + axe run on the built app and block merges.
- Baseline timing numbers recorded for: cold open, task capture, task
  completion, navigation, search.

**Risks:** Measurement tooling adds CI time; keep gates lightweight and run
them on the production build, not every dev commit. No claim of runtime
improvement until measured.

---

## Phase 1 — Core daily experience (P1 Execution)

**Scope:**

- Dashboard reordered to execution-first: top priority / first overdue task as
  the primary action, then habits-due and focus-vs-target; optional cards
  (level, achievements, progress) remain behind `settings.dashboardCards`.
  Avoid a decorative card grid.
- "Done today" celebratory strip under the digest line (secondary, never
  replacing the pending list).
- Recovery: "Reset this week" shifts overdue tasks to today with undo (already
  in `src/lib/store.ts` as `recovery.resetWeek`); surface it on the dashboard
  when overdue tasks exist.
- Habits: streak-freeze chip visible on the today row; habit template chips
  (Morning routine / Deep work block) in the new-habit form.
- Focus: one-tap start/pause (exists); suggested top-priority task link as an
  opt-in chip; weekly distraction aggregate row.
- Notes: "Create tasks from checklist" parses `- [ ]` items into tasks linked
  to the note, with undo.
- Tasks: task template chooser in quick add (Deep work session / Weekly
  review).
- Quick-add: extended bilingual priority aliases (urgent/عاجل, average/عادي,
  easy/سهل); ⌘K "New task" opens global capture from any route (matches `n`
  key + mobile FAB).

**Expected outcome:** The capture→execute loop is fast, forgiving, and
consistent everywhere. Missed days don't cascade into shame lists.

**Dependencies:** Existing pure engines (`quickAdd.ts`, `streaks.ts`,
`focusTime.ts`, `dashboard.ts`, `noteTasks.ts`, `energy.ts`, `templates.ts`);
`recovery.resetWeek` in store.

**Acceptance criteria:**

- Task capture from decision to saved < 3 seconds (measured, Phase 0 baseline).
- Completion reflects in counts/rings on the same frame; undo available ≥ 5 s.
- Reset-week is one opt-in action with an undo toast; never auto-reschedules
  the whole schedule.
- All P1 changes tested via existing colocated `*.test.ts`; 439+ tests pass,
  typecheck 0 errors, eslint clean.

**Risks:** Over-customizing the dashboard re-introduces the setup trap.
Mitigation: one primary action + three scannable rows; everything else
optional and off by default where sensible.

---

## Phase 2 — Execution and recovery (P1 Execution + P2 Intelligence)

**Scope:**

- Overload detection: when a day has more due than plausible capacity, surface
  a per-task "reschedule tomorrow" option — opt-in, undoable, never auto-rewrite
  the whole schedule (Motion-style automation is rejected by users).
- Plan page: energy-aware suggested block shown as an opt-in "Pin to {time}"
  chip for top-priority tasks; manual drag/nudge remains primary; overflow list
  warns when the day is overfull.
- Weekly review (exists as `weeklyReview()` engine + Insights panel): keep
  honest, floor-gated claims; consider a plain-text/print export of the weekly
  review if users want to review outside the app.
- Focus: actual vs planned minutes in history (exists); keep timer correctness
  and one-tap control.

**Expected outcome:** Planning is realistic without taking control from the
user; recovery is easy; review informs decisions without vanity metrics.

**Dependencies:** Phase 1; `src/lib/energy.ts`, `src/lib/insights.ts`
(`weeklyReview`, `insightsReport` with data floors).

**Acceptance criteria:**

- No schedule mutation occurs without an explicit user tap + undo.
- Every insight carries its basis ("based on N events over D active days");
  no claim appears below its data floor.
- Suggestions are explicitly labeled as drafts the user approves.

**Risks:** Suggestions that feel like commands erode trust. Mitigation: explicit
opt-in actions; nothing moves without a tap.

---

## Phase 3 — Intelligence and insights (P2 Intelligence)

**Scope:**

- Extend the observations engine only where a claim informs a decision.
  Candidate: a plain-language "where did my time go" view combining
  `focusMinutesByDay` + `taskCompletionsByDay`, labeled as planned focus time
  (not actual tracked time).
- Local-only weekly summary (pure JS over the local snapshot, no external
  model, no keys, no network) — opt-in, honest about its limits.
- Note→task extraction refinement (already in `noteTasks.ts`); consider
  surfacing it more prominently in the note editor if usage confirms demand.

**Expected outcome:** Insights that recommend actionable improvements, privacy-first,
no subscription, no AI decorative layer.

**Dependencies:** Phase 2; `src/lib/insights.ts`, `src/lib/noteTasks.ts`.

**Acceptance criteria:**

- Every insight has a data floor and a basis line; no claim below minimum.
- Local summary runs entirely in the browser; nothing leaves the device.

**Risks:** "AI" features risk becoming decorative chatbots. Mitigation: if it
isn't deterministic, explainable, and optional, don't build it.

---

## Phase 4 — Optional personalization and integrations (P3 Personalization)

**Scope (deferred, revisit on evidence):**

- Native iOS/Android app (PWA covers install + offline today).
- Calendar-event creation (tasks ≠ appointments) — low frequency, adds
  complexity.
- Voice capture — Web Speech API; only if requested and validated.
- Bundle/runtime performance optimization beyond Phase 0 measurement — only
  if profiling at realistic record counts shows a hotspot (no speculative
  memoization/virtualization).
- A formal Goal → Project → Action hierarchy — deferred; tags + notes +
  `linkedTaskId` already provide lightweight connection.

**Expected outcome:** Optional power-user options without complicating the
default.

**Dependencies:** Phase 0–2 stability; evidence of demand.

**Acceptance criteria:** Any addition must pass the three tests (User Value,
Experience Quality, Engineering Sustainability) and not add a mandatory
configuration step before first use.

**Risks:** Personalization bloat. Mitigation: add settings only when a specific,
requested, low-complexity option emerges; default stays simple.

---

## Phase gates

| Gate              | Condition to proceed                                                           |
| ----------------- | ------------------------------------------------------------------------------ |
| Phase 0 → Phase 1 | Baseline timing recorded; CI measurement gates green.                          |
| Phase 1 → Phase 2 | P1 acceptance criteria met; no regression in capture/completion latency.       |
| Phase 2 → Phase 3 | At least one P2 idea validated by usage metrics before building more.          |
| Phase 3 → Phase 4 | Demand evidence for a specific personalization option; default remains simple. |

**Explicitly out of scope (rejected, see `docs/strategy/16-rejected-ideas.md`):**
team collaboration, calendar-event write-back, heavy NLP, AI auto-rescheduling,
location-based reminders, weekly-count habits, social feeds, decorative
animations, push notifications, full Notion/Obsidian replacement, native apps
before PWA is proven.
