# Tilth — Feature Opportunity Matrix (Deliverable C)

Each of the 10 opportunity areas from the brief is evaluated against the
actual implementation and the product principles. Recommendation is one of:

- **Build now** — small, additive, high-confidence, verified.
- **Improve** — exists but needs polish/integration.
- **Defer** — valid but not for the near term; revisit after Phase 0–1.
- **Reject** — conflicts with principles or weak evidence.

Priority: **P0 Foundation** (core workflows, responsiveness, usability,
measurement), **P1 Execution** (daily planning, completion, habits, focus),
**P2 Intelligence** (insights, contextual suggestions), **P3 Personalization**
(optional customization).

Evidence base: `docs/research/01-...` competitor & sentiment reports,
`docs/research/09-evidence-research-register.md`, prior audit reports.

---

## 4.1 Adaptive Today Dashboard

**User problem:** Opening the app should answer "what do I do now?" in one
glance, not present a decorative grid of counters the user must interpret.

**Current state:** `/` dashboard has toggleable cards (priorities, progress,
deadlines, habits, focus, level, achievements) plus a digest line and — in the
current tree — a "done today" strip. Cards show/hide via
`settings.dashboardCards`; first-run welcome panel links to /tasks and /habits.

**Proposed solution:** Keep the dashboard small. Surface the single most
important action first (top priority / first overdue task), keep habits-due and
focus-vs-target, and relegate history/level/achievements to optional cards.
Avoid auto-adapting emphasis by opaque context — that adds complexity without
proven benefit. "Adaptive" here means the user toggles what shows, not the app
rearranging itself.

**Expected impact:** High. Reduces decision fatigue on open; directly supports
execution-over-planning.

**Implementation complexity:** Low — card visibility + ordering already exist;
reordering/prioritizing the first card is a small UI change.

**Dependencies:** None beyond existing `dashboard.ts` + route.

**Risks:** Turning the dashboard into a card grid with counters (the brief
explicitly warns against this). Mitigation: keep one primary action + three
scannable rows; everything else optional.

**Priority:** P1 Execution.

**Recommendation:** **Improve** — reorder to execution-first, keep optional.

---

## 4.2 Universal Capture and Command Center

**User problem:** The time between "I should capture this" and "it's saved"
determines whether capture happens at all. Every extra tap loses ideas.

**Current state:** `QuickCapture` modal reachable via `n` key (desktop), mobile
FAB, and sidebar button — from any route. Inline grammar `!high #tag tomorrow`
(and Arabic aliases) parsed synchronously; live chips show parsed result while
typing. ⌘K palette's "New task" now opens the same modal from any route (prior
build). `captureFromText` handles task/note/habit/focus prefixes and bare URLs.

**Proposed solution:** No new system. Keep one capture field. Consider one
additional global entry point only if friction is confirmed (e.g., share
target). The command center already exists via ⌘K; content search ranks tasks,
notes, habits.

**Expected impact:** High. Capture speed is the #1 loved experience across
competitors (Todoist/TickTick/Things 3) and the #1 abandonment cause when slow
(Notion).

**Implementation complexity:** Low — all pieces exist and are tested.

**Dependencies:** None.

**Risks:** Adding capture channels (share sheet, voice, widgets) multiplies
surface area without proven demand. Mitigation: stay with the three existing
entry points; add voice only if requested and validated.

**Priority:** P0 Foundation (capture is the core workflow).

**Recommendation:** **Improve** — keep single-field capture; validate before
adding channels.

---

## 4.3 Smart Recovery System

**User problem:** One missed day cascades into a shame list of overdue tasks;
users abandon because the backlog feels unrecoverable (Reddit: "productivity
trap", habit burnout from tracking too many).

**Current state:** `recovery.resetWeek()` in store shifts overdue open tasks to
today with previous dueDates recorded for an undo toast. Dashboard shows a
"Reset this week" button when overdue tasks exist (prior build). Habits have
streak freeze (skip-limit recovery, max 2 skips/week) and pause windows.

**Proposed solution:** Extend recovery gently:

- Detect overloaded days (more due than plausible capacity) and surface a
  "reschedule tomorrow" option for individual tasks — never auto-rewrite the
  whole schedule (Motion-style automation is rejected by users).
- Recommend smaller next actions for overdue tasks (break into subtasks;
  subtasks already exist on tasks).
- Keep "preserve genuine deadlines" — don't move hard due dates without
  consent.

**Expected impact:** High. Directly addresses the #1 abandonment reason (backlog
shame) with low interaction cost.

**Implementation complexity:** Low-Medium. Reset week exists; overload detection
and per-task reschedule are small additions.

**Dependencies:** Existing `tasks.complete`/`update`, undo toast pattern.

**Risks:** Auto-rescheduling without permission erodes trust. Mitigation: every
change is one opt-in action with an undo toast.

**Priority:** P1 Execution.

**Recommendation:** **Build now** — reset week done; add overload detection +
per-task reschedule (opt-in, undoable).

---

## 4.4 Goal → Project → Action System

**User problem:** Users want to know why a task matters and which goal it
serves, but a mandatory hierarchy adds configuration and abstraction.

**Current state:** Tasks have `notes`, `tags`, `subtasks`, `linkedTaskId`;
notes link to tasks via `linkedTaskId`. There is no explicit Goal/Project
entity, and no mandatory parent relationship. Recurrence `seriesId` links
repeating instances.

**Proposed solution:** Defer a formal Goal/Project entity. Tags + notes +
`linkedTaskId` already provide lightweight connection without new collections
or mandatory relationships. If users consistently request goal linkage, add a
single optional `goalId` on tasks — one field, no new UI surface until needed.

**Expected impact:** Low-Medium now; higher only if evidence shows users need
goal context.

**Implementation complexity:** Medium (new collection, migrations, UI) if built;
None if deferred.

**Dependencies:** None if deferred.

**Risks:** A mandatory hierarchy forces users to classify before acting —
exactly the setup trap Tilth avoids. "Keep the hierarchy lightweight and avoid
unnecessary mandatory relationships" (brief).

**Priority:** P3 Personalization (defer).

**Recommendation:** **Defer** — tags/notes/linkedTaskId cover it; revisit on
evidence.

---

## 4.5 Intelligent Timeboxing

**User problem:** Tasks need a time, not just a date, but aggressive
auto-scheduling (Motion) is rejected as invasive ("someone else driving").

**Current state:** `/plan` time-blocks tasks via `blockStart` (minutes from
midnight) with drag-to-schedule, nudge ±15 min, pin/unpin, overflow list.
`buildDayPlan`/`layoutDayPlan` in `src/lib/plan.ts`. Energy-aware suggested
block lib (`src/lib/energy.ts`) computes top completion hour; UI wiring in the
current tree.

**Proposed solution:** Keep suggestions opt-in and user-approved. Show a
"suggested block" chip for top-priority tasks; user taps to pin. Never
auto-reschedule existing blocks. Warn (don't block) when the day is overfull
(overflow list already exists).

**Expected impact:** Medium-High. Makes planning realistic without taking
control from the user.

**Implementation complexity:** Low — plan page + energy lib exist; wiring is
small.

**Dependencies:** `src/lib/energy.ts`, `buildDayPlan`.

**Risks:** Suggestions that feel like commands. Mitigation: explicit "Pin to
{time}" action; nothing moves without a tap.

**Priority:** P1 Execution.

**Recommendation:** **Improve** — suggestions are opt-in; keep manual drag as
primary.

---

## 4.6 Context-Aware Habits and Routines

**User problem:** Rigid streaks punish missed days; users add too many habits
then burn out (Reddit: burned out tracking 5–6 habits in a week).

**Current state:** Daily/weekly/custom schedules reduce to `HabitSchedule.days`;
`isScheduledOn` single source of truth. Streaks: skip-neither-breaks-nor-extends,
skip-limit recovery (max 2/week), unscheduled days never break, today never
breaks until day ends. Streak freeze (pause window) added to today row.
Habit templates (Morning routine / Deep work block) added as one-tap bounded
starts.

**Proposed solution:** Keep as-is plus templates. Do not add weekly-count
habits ("3x/week" — explicitly out of scope v1 per architecture contract).
Do not make streak preservation more important than behavior — freeze is
optional, streaks don't punish single misses.

**Expected impact:** High. Forgiving habit design is a known retention factor
(Loop's appeal) and avoids the burnout abandonment path.

**Implementation complexity:** Low — all pieces exist and are tested.

**Dependencies:** `streaks.ts`, `habits.tsx`.

**Risks:** Adding habit categories/folders or weekly-count schedules adds
complexity without strong demand. Mitigation: stay bounded.

**Priority:** P1 Execution.

**Recommendation:** **Improve** — templates + freeze surface done; keep scope
bounded.

---

## 4.7 Focus Intelligence

**User problem:** Focus sessions feel disconnected from the task list; users
don't know if timers are trustworthy after backgrounding.

**Current state:** Pomodoro/custom timers, timestamp-based `remainingMs`
(survives reloads/background), `linkedTaskId` on sessions, distraction counter,
ambience (rain/brown/white), Space/Esc keyboard, history grouped by stored
day, `workMinutesToday` vs daily target on dashboard. Focus→task suggestion
and weekly distraction aggregate added in current tree.

**Proposed solution:** Keep one-tap start/pause; the suggestion chip (top
priority task) is opt-in. Show actual vs planned minutes in history (already
done). Break management via `nextBreakMinutes` (long break after 4 sessions).
No push notifications (v1 explicitly states none) — consistent with
local-first.

**Expected impact:** High. Timer correctness is a trust foundation; linking
focus to tasks closes the execute→prioritize loop.

**Implementation complexity:** Low — all pieces exist and are tested.

**Dependencies:** `focusTime.ts`, `focus.tsx`.

**Risks:** Adding distraction-blocking or automatic focus suggestions expands
scope beyond a personal timer. Mitigation: keep the timer; distraction logging
is manual.

**Priority:** P1 Execution.

**Recommendation:** **Improve** — suggestion chip + distraction surface done;
keep manual control.

---

## 4.8 Weekly Intelligence Review

**User problem:** Users need periodic reflection, not just daily execution, but
vanity metrics reward activity without measuring progress.

**Current state:** `weeklyReview()` in `src/lib/insights.ts` produces this-week
vs last-week tasks done, focus minutes, habits done, XP, plus carry-over
candidates. Insights page renders it as the Review Panel with trend arrows.
Observations engine has data floors (MIN_ACTIVE_DAYS=14, per-claim minimums) so
claims only appear when supported. `monthOverMonth` and `weekdayFocus` also
exist.

**Proposed solution:** Keep honest-claims-only. Every insight carries its basis
("based on N events over D active days"). No new metrics without a clear
decision they inform. Consider exporting the weekly review as plain text/print
(low cost) if users want to review outside the app.

**Expected impact:** Medium. Supports the Review step of the journey without
vanity metrics.

**Implementation complexity:** Low — engine + UI exist; export variant is small.

**Dependencies:** `src/lib/insights.ts`, `src/routes/insights.lazy.tsx`.

**Risks:** Adding AI-generated summaries or predictive claims breaks the
"honest claims with data floors" contract. Mitigation: keep it deterministic.

**Priority:** P2 Intelligence.

**Recommendation:** **Improve** — engine/UI exist; keep honest, floor-gated
claims only.

---

## 4.9 Connected Notes and Knowledge

**User problem:** Notes captured in one place never connect to tasks/projects,
so context is lost when executing.

**Current state:** Notes are Markdown records with optional `linkedTaskId`;
linked-task select in the editor; notes sit outside the XP economy
(`applyRewardEvent` never called for notes). `mdToHtml` escapes HTML first,
safe subset, `dir="auto"` blocks. Four bilingual note templates. `extractChecklistTasks`
(`src/lib/noteTasks.ts`) parses `- [ ]` items into tasks linked to the note;
UI action added in current tree.

**Proposed solution:** Keep lightweight. Notes attach to tasks via
`linkedTaskId`; checklist extraction turns note ideas into tasks. Do not build
bidirectional linking, graph view, or full-text search across notes beyond the
existing contains filter — that recreates Notion/Obsidian, which the brief
rejects.

**Expected impact:** Medium. Connects supporting information to execution
without a knowledge-management subsystem.

**Implementation complexity:** Low — extraction lib + UI action exist.

**Dependencies:** `noteTasks.ts`, `notes.tsx`.

**Risks:** Expanding notes into a "second brain" adds complexity and competes
with Obsidian/Notion on their home turf. Mitigation: notes stay task-adjacent,
not a knowledge OS.

**Priority:** P2 Intelligence.

**Recommendation:** **Improve** — checklist extraction done; keep notes
task-adjacent.

---

## 4.10 Modular Personalization

**User problem:** Advanced users want to customize, but every added setting is
another thing to maintain — and the default must stay simple.

**Current state:** `settings.dashboardCards` toggles seven cards; accent themes
(5) with WCAG-AA-pinned contrast; language (ar/en); theme (light/dark/system);
dayStartHour; weekStartsOn; daily focus target. Settings documents only wired
shortcuts. The settings store-status panel is debug-only.

**Proposed solution:** Defer a full modular system. The existing toggle model
(cards, accent, language) already provides personalization without a settings
maze. Add new toggles only when a specific, requested, low-complexity option
emerges.

**Expected impact:** Low now. Personalization is a retention nicety, not an
execution driver.

**Implementation complexity:** Medium if expanded; None if deferred.

**Dependencies:** None if deferred.

**Risks:** Hundreds of configuration options are explicitly in the "avoid"
list. Every new setting is a tax on the default experience.

**Priority:** P3 Personalization (defer).

**Recommendation:** **Defer** — existing toggles suffice; add only on evidence.

---

## Summary of recommendations

| Opportunity                    | Recommendation | Priority |
| ------------------------------ | -------------- | -------- |
| 4.1 Adaptive Today Dashboard   | Improve        | P1       |
| 4.2 Universal Capture          | Improve        | P0       |
| 4.3 Smart Recovery             | Build now      | P1       |
| 4.4 Goal→Project→Action        | Defer          | P3       |
| 4.5 Intelligent Timeboxing     | Improve        | P1       |
| 4.6 Context-Aware Habits       | Improve        | P1       |
| 4.7 Focus Intelligence         | Improve        | P1       |
| 4.8 Weekly Intelligence Review | Improve        | P2       |
| 4.9 Connected Notes            | Improve        | P2       |
| 4.10 Modular Personalization   | Defer          | P3       |

The pattern is deliberate: almost everything valuable already exists as a pure,
tested engine; the remaining work is wiring, polish, and measurement — not new
modules. This keeps Tilth coherent and avoids the setup trap.
