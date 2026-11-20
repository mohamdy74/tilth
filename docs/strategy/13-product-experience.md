# Tilth — Recommended Product Experience (Deliverable D)

The ideal daily workflow, mapped to the Capture → Organize → Prioritize → Plan
→ Execute → Review → Improve journey. Describes what the user does, what the
app handles automatically, and which screens support each step. Grounded in the
actual implementation (`src/routes/*`, `src/lib/*`) and the opportunity matrix
(`docs/strategy/12-opportunity-matrix.md`).

Guiding principle: **Maximum useful capability with minimum interaction cost.**
Nothing is mandatory before the first capture. Nothing is automatic without
user consent.

---

## 1. Opening the application

**What the user does:** Opens the installed PWA (or browser tab) and lands on
`/`, the Today dashboard.

**What the app shows:** A skeleton until the store is `ready` (local-first
boot after hydration, no SSR data fetch). Then the dashboard greeting (morning
before 17:00, evening after) with the digest line — e.g. "3 tasks due · 2
overdue · 1 habit due" — plus the execution-first cards: top priorities,
today's habits due, focus minutes vs target. Everything else (level,
achievements, progress ring) is optional via `settings.dashboardCards`.

**What happens automatically:** Store boots from IndexedDB; multi-tab sync
reconciles if another tab wrote; digest fires at most once per slot per day if
enabled and permission granted. No network, no account, no loading spinner
beyond the skeleton.

**Interaction cost:** ~0 seconds to see today's plate; capture is one `n` key
or ⌘K away from any route.

---

## 2. Capturing a new task

**What the user does:** Presses `n` (desktop), taps the FAB (mobile), opens
⌘K → "New task", or uses the sidebar capture button — from any route. Types one
line: `"buy milk !high #errands tomorrow"`. Live chips show parsed priority,
tags, and due date while typing. Presses Enter.

**What the app handles automatically:** `parseQuickAdd` (pure, synchronous)
splits the title from `!` priority flags, `#` tags, and date words (EN + AR).
`tasks.add` writes to IndexedDB (debounced 250 ms, flushed on tab hide) and
returns instantly; the undo toast is available but capture itself is
fire-and-forget.

**Screens:** `QuickCapture` modal (`src/components/app/QuickCapture.tsx`),
reachable globally via `AppShell`; `parseQuickAdd` in `src/lib/quickAdd.ts`.

**Interaction cost:** One field, one Enter — under 3 seconds from decision to
saved. The parse result is visible before committing, so nothing has to be
remembered.

---

## 3. Reviewing priorities

**What the user does:** On `/`, the Priorities card lists open tasks due today
or overdue — priority first, then earlier dates — each with a one-tap done
button and an undo toast. Optionally opens `/tasks` to see today/upcoming/
overdue/inbox/completed buckets, filters (priority, tag, search), saved views,
and list or kanban board.

**What the app handles automatically:** `todaysPriorities` / `upcomingDeadlines`
/`habitsDueToday` / `dailyProgress` are pure functions over stored `localDay`
strings vs `todayLocal()` — nothing is recomputed from the wall clock. The
digest line under the title summarizes the day.

**Screens:** `/` (dashboard), `/tasks` (`src/routes/tasks.tsx`), `src/lib/dashboard.ts`.

**Interaction cost:** Priorities visible immediately on open; completing is one
tap with instant UI reflection.

---

## 4. Planning the day

**What the user does:** Opens `/plan` — "Everything due today, laid out on one
timeline." Tasks due today appear as blocks on a 09:00–22:00 timeline. Drags a
task onto the timeline to pin its start (`blockStart`), nudges ±15 min, pins or
unpins. Tasks that don't fit land in the overflow list ("Did not fit today")
with a hint to move one to another day or shorten the day.

**What the app handles automatically:** `buildDayPlan` / `layoutDayPlan`
(`src/lib/plan.ts`) derive blocks from tasks, habits, and focus target. An
energy-aware suggested block (`src/lib/energy.ts`) offers a start time for the
top-priority task based on when the user historically completes work — shown as
an opt-in "Pin to {time}" chip, never applied automatically. The now-minute
line scrolls the timeline to the present.

**Screens:** `/plan` (`src/routes/plan.tsx`), `src/lib/plan.ts`,
`src/lib/energy.ts`.

**Interaction cost:** Planning is manual drag/nudge; suggestion is one opt-in
tap. Nothing moves without the user's action.

---

## 5. Starting focused work

**What the user does:** From `/plan` (focus block links to `/focus`), the
dashboard focus card, or ⌘K → content search → a task, opens `/focus`. Chooses
pomodoro (25/5, long break 15 after 4) or custom minutes, optionally links a
task, and taps Start. Space toggles pause/resume; Esc cancels with a confirm
modal.

**What the app handles automatically:** `focusApi.start` creates a session with
`startedAt`/`endsAt` timestamps. `remainingMs` is computed from timestamps vs
wall clock every render — the 500 ms interval only re-renders, never counts.
The timer survives reloads, background tabs, and sleeping phones. If the
session runs to `endsAt`, it auto-completes on the next tick/visibility change;
cancel/early stop saves `completed=false`. Completion plays a best-effort
WebAudio chime + vibration (toggle persists in localStorage, a tiny UI pref,
not app data). Distractions can be logged mid-session.

**Screens:** `/focus` (`src/routes/focus.tsx`), `src/lib/focusTime.ts`.

**Interaction cost:** One tap to start; one tap to pause; the timer is always
correct, so there's no anxiety about drift.

---

## 6. Completing or postponing tasks

**What the user does:** Completes a task from the Priorities card, `/tasks`,
`/plan`, or the focus session's suggested link. One tap toggles done; an undo
toast appears (and removes any spawned next instance of a recurring series).
To postpone, edits the due date in the task editor or drags the block on `/plan`.

**What the app handles automatically:** `tasks.complete` sets `completedAt`,
fires the single `applyRewardEvent` wiring (awards XP/coins via the pure
rewards engine, revokes on reopen), and — if recurring — creates only the
next instance (same `seriesId`, next occurrence). `tasks.reopen` clears
`completedAt` and revokes the award. No double-awarding across complete→undo→redo.

**Screens:** `/`, `/tasks`, `/plan`, `/focus`.

**Interaction cost:** One tap; undo available for ~5 seconds.

---

## 7. Handling missed tasks

**What the user does:** When overdue tasks exist, the dashboard shows a
"Reset this week" button (when applicable). Tapping shifts overdue open tasks
to today, recording previous dueDates for an undo toast. Habits use streak
freeze (pause window) and skip-limit recovery (max 2 skips/week; a 3rd skip in
a week breaks, unscheduled days never break). The weekly review on `/insights`
shows carry-over candidates (open tasks due on/before week end) with a "Carry
all" button.

**What the app handles automatically:** `recovery.resetWeek()` in `src/lib/store.ts`
is gentle: never deletes, never touches habits, never re-dates anything due
today or in the future. Everything is undoable. Streaks and consistency are
pure functions (`src/lib/streaks.ts`) over stored days — a missed day doesn't
erase progress.

**Screens:** `/` (recovery button), `/insights` (weekly review carry-over),
`/habits` (freeze + heatmap).

**Interaction cost:** One opt-in action with undo; no shame-based messaging,
no manipulative streak mechanics.

---

## 8. Reviewing progress

**What the user does:** Opens `/insights` — charts for task completions, habit
consistency, and focus minutes over the last 28 days (or 30 monthly), plus the
weekly review (this week vs last week: tasks done, focus minutes, habits done,
XP) and carry-over candidates. Observations appear only when data clears
floors (14 active days; 10 tasks for time-of-day; 6 sessions on 3+ weekdays;
3 skips for most-skipped habit), each carrying its basis ("based on N events
over D active days").

**What the app handles automatically:** `insightsReport`, `weeklyReview`,
`taskCompletionsByDay`, `habitConsistencyByDay`, `focusMinutesByDay`,
`weekdayFocus`, `monthOverMonth` are pure engines (`src/lib/insights.ts`) with
data floors — no claim appears below the minimum, and every claim renders its
sample size. Recharts never renders on the server (skeleton-first pattern).
Charts recolor with accent themes via CSS tokens; Arabic uses ar-EG digits and
mirrored axes.

**Screens:** `/insights` (`src/routes/insights.lazy.tsx`), `src/lib/insights.ts`.

**Interaction cost:** Review is honest and floor-gated — no vanity metrics, no
AI-generated claims.

---

## 9. Preparing for tomorrow

**What the user does:** Before closing, the evening digest (after 17:00 if
enabled) summarizes completed today, focus minutes, still-open, and tomorrow's
open tasks. The user may carry over tasks via the weekly review or simply
leave them — tomorrow's dashboard recomputes from stored `localDay` strings,
so nothing is stale after a timezone or schedule change.

**What the app handles automatically:** `digestFor` picks evening digest from
17:00; delivery is the local Notification API while the app is open (no push
server), tagged so repeats replace rather than stack; `localStorage
tilth.digest` (slot→day) is a tiny UI pref, not app data. `todayLocal()`
honors `settings.dayStartHour` so a record's day survives later changes.

**Screens:** `/` (evening digest line), `/settings` (digest prefs).

**Interaction cost:** Nothing required — the digest is optional, silent by
default, and fires at most once per slot per day.

---

## How screens relate

| Screen      | Role in journey                       | Key pure engine                                             |
| ----------- | ------------------------------------- | ----------------------------------------------------------- |
| `/`         | Capture's landing + daily review      | `dashboard.ts`, `digest.ts`                                 |
| `/tasks`    | Organize + Prioritize                 | `quickAdd.ts`, `taskViews.ts`, `taskSort.ts`                |
| `/habits`   | Build routines                        | `streaks.ts`                                                |
| `/focus`    | Execute                               | `focusTime.ts`                                              |
| `/plan`     | Plan (time-block)                     | `plan.ts`, `energy.ts`                                      |
| `/notes`    | Supporting information                | `notes.ts`, `noteTasks.ts`                                  |
| `/calendar` | Weekly view                           | `weekView.ts`                                               |
| `/insights` | Review + Improve                      | `insights.ts`                                               |
| `/rewards`  | XP, coins, shop, achievements         | `rewards.ts`, `shop.ts`, `achievements.ts`, `challenges.ts` |
| `/settings` | Customization (optional toggles only) | `store.ts`                                                  |

**What Tilth deliberately refuses to become:** a team collaboration tool, a
calendar-event system (it time-blocks tasks; it doesn't write calendar events),
a Notion/Obsidian knowledge OS, or an opaque AI scheduler that rewrites your
day. Every suggestion is a draft the user approves; every destructive action
has undo; data never leaves the device unless the user opts into encrypted
sync.
