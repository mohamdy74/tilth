# Deliverable 6 — Ideal Tilth Product Blueprint

A coherent product structure derived from the research. Guiding principle:
**Maximum useful capability with minimum interaction cost.** Tilth deliberately
does not prescribe a separate module for every feature; it favors coherent
workflows across the Capture → Organize → Prioritize → Plan → Execute →
Review → Improve journey.

---

## Product vision

Tilth should be exceptionally good at **helping a person capture what matters,
plan a realistic day, and do focused work — without the app becoming the work.**
It is local-first, Arabic-first by default, subscription-free, and calm.

**What Tilth deliberately refuses to become:** a team collaboration tool, a
calendar-event system, an all-in-one knowledge OS (Notion clone), or an opaque
AI scheduler that rebuilds your day without consent.

---

## Core modules (existing pages, kept)

| Module          | Path        | Role in journey                                                |
| --------------- | ----------- | -------------------------------------------------------------- |
| Today dashboard | `/`         | Capture's landing + Review glance                              |
| Tasks           | `/tasks`    | Organize + Prioritize (quick add, buckets, board, saved views) |
| Habits          | `/habits`   | Build consistent routines                                      |
| Focus           | `/focus`    | Execute (protected focus time)                                 |
| Notes           | `/notes`    | Supporting information (outside XP economy)                    |
| Calendar        | `/calendar` | Plan (weekly time blocks)                                      |
| Rewards         | `/rewards`  | Review (XP, coins, shop, achievements)                         |
| Insights        | `/insights` | Improve (honest observations with data floors)                 |
| Settings        | `/settings` | Customization                                                  |
| Plan            | `/plan`     | Plan (time blocking, blockStart)                               |

No new module for every feature. New capabilities (done list, weekly review,
recovery day) are surfaces _within_ existing modules.

---

## Navigation

- **Bottom nav (8 tabs):** Today, Tasks, Habits, Focus, Notes, Calendar, Rewards,
  Insights. (Settings reachable from Today / profile.) Every section is a real
  page — matches existing architecture (B19).
- **⌘K palette:** instant capture entries (new task / note / habit), instant
  toggles (language, theme). Capture entries set a sessionStorage flag; target
  page consumes it on mount.
- **No settings-gated features.** Nothing requires configuration before first
  use.

---

## Main dashboard (/)

- Skeleton until `ready`; welcome panel on first run linking to /tasks and
  /habits.
- Digest line under the title (morning before 17:00, evening after) — visible
  even with notifications off.
- Toggleable cards: Priorities, Progress, Deadlines, Habits, Focus, Level,
  Achievements (existing `settings.dashboardCards`).
- Priorities card: open tasks due today or overdue, one-tap complete with undo
  toast.
- Focus card: completed work minutes vs daily target.
- Level card: live level, XP progress, today XP vs DAILY_XP_CAP, coins.
- **Add (blueprint):** a "Done today" strip celebrating completions (Deliverable
  5 proposal #9) — secondary, never replacing the pending list.

---

## Daily workflow (the journey)

**Capture:** ⌘K → "New task" → quick-add bar (`title !high #tag tomorrow`) →
saved in <3 seconds. Task notes added later in editor, not at capture.

**Organize:** /tasks buckets (today/upcoming/overdue/inbox/completed), tags,
priority, saved views; list or kanban board; subtasks; recurrence (next
instance only on completion).

**Prioritize:** dashboard Priorities card; "start today" one-tap surface; sort
by due/priority/created.

**Plan:** /plan time-blocking (blockStart) + /calendar week view; optional
energy-aware block suggestions (Deliverable 5 #1) — draft only, user approves.

**Execute:** /focus pomodoro/custom; timestamp-correct timer (survives
background/reload); linked task; distractions logged; ambience optional.
Space start/pause, Esc cancel.

**Review:** /rewards (XP, level, shop, achievements), /insights (charts +
observations with data floors), evening digest.

**Improve:** weekly review digest (Deliverable 5 #4), time-allocation view
(Deliverable 5 #6), recovery day after missed days (Deliverable 5 #2).

---

## How capabilities relate

- **Tasks ↔ Focus:** `linkedTaskId` on sessions; completing a focused task
  offers one-tap task done (Deliverable 5 #3).
- **Tasks ↔ Habits:** both feed XP/coins via the single `applyRewardEvent`
  wiring; both appear on dashboard and calendar.
- **Tasks ↔ Notes:** `linkedTaskId` on notes; note-to-task extraction from
  markdown checklists (Deliverable 5 #5).
- **Tasks ↔ Calendar:** tasks with dueDate appear on /calendar week cells;
  plan page time-blocks tasks (blockStart).
- **Rewards ← everything:** one wiring point; pages never write xpLedger.
- **Notes:** outside the XP economy — no reward events, no ledger entries.

---

## Immediately accessible

- Quick-add bar on /tasks; ⌘K global capture.
- Today's priorities and habits-due on dashboard.
- Focus start button.

## Optional / hidden until needed

- Recurrence, subtasks, blockStart, notes (inside task editor).
- Saved views (named filters).
- Streak freeze, habit archive.
- Shop, achievements, insights (grow with use).
- Settings (language, theme, accent, dashboard cards, sync).

---

## What works together automatically (and what doesn't)

**Automatic:** XP/coins on complete/log/end; next recurring instance on task
completion; streak & consistency recalculation; insights observations; digest
slot firing; multi-tab sync; undo on destructive actions.

**Never automatic:** calendar mutation, task re-dating, focus session
completion (only when it ran to endsAt), reward awards without user action.
AI suggestions are drafts the user approves.
