# Deliverable 5 — Innovative Feature Proposals

At least 10 differentiated opportunities. Each is labeled **hypothesis** (not a
proven user need) unless directly evidenced. Implementation complexity is
relative to Tilth's existing codebase. Validation method is concrete and cheap.

---

## 1. Energy-aware daily plan (hypothesis)

**Concept:** The plan page suggests work blocks matched to the user's observed
energy curve (from insights: when tasks are usually completed). Morning
completions → schedule deep work mornings; afternoon → lighter admin.

**User problem:** Users plan by clock, not by energy, so plans are unrealistic.

**Why alternatives fail:** Motion auto-schedules by priority/time only and is
rejected as invasive (P17/P18). Sunsama is manual only. Neither uses the
user's actual completion rhythm.

**How it works:** Insights engine already computes taskCompletionsByDay by hour
(B12). A read-only suggestion layer flags "your deep-work window is 9–11" and
pre-fills block suggestions the user accepts or ignores. Never auto-moves
existing blocks.

**Advantages:** Uses data Tilth already collects; explainable; optional; no
calendar mutation without consent.

**Limitations:** Energy ≠ completion hour (meetings interfere); could over-fit
to a few weeks.

**Complexity:** Medium (insights integration + plan UI).

**Validation:** A/B the suggestion acceptance rate; track whether accepted
blocks correlate with task completion.

---

## 2. "Recovery day" after missed days (hypothesis)

**Concept:** When a user has missed several scheduled days (habits overdue,
tasks overdue), offer a one-tap "reset this week" that re-due-dates overdue
tasks to today/tomorrow and clears skipped habit logs, with an undo toast.

**User problem:** One bad week cascades; users abandon because the backlog
feels unrecoverable (C3 productivity trap; C4 burnout).

**Why alternatives fail:** Most apps show overdue as a growing shame list with
no recovery path. Habit streak apps punish breaks.

**How it works:** Detect N overdue tasks + M missed habit days; surface a
gentle "start fresh this week" action. Re-date overdue tasks forward; archive
or clear stale skips. One undoable action.

**Advantages:** Directly addresses abandonment reason #3 (backlog shame).
Uses existing soft-delete/undo infra.

**Limitations:** Could encourage procrastination ("I'll just reset later");
must be clearly opt-in per reset.

**Complexity:** Low-Medium (reuses tasks.update/habits.unlog + undo).

**Validation:** Measure reset usage and subsequent retention (do users keep
using after a reset vs. abandoning).

---

## 3. Focus-to-task bridge: auto-link session to today's top priority (hypothesis)

**Concept:** When starting a focus session with no linked task, suggest the
top priority task (from dashboard todaysPriorities) as the default link; one
tap to attach. Session end can offer "mark this task done."

**User problem:** Focus sessions and task list feel like separate apps; users
don't connect deep work to outcomes.

**Why alternatives fail:** TickTick has Pomodoro but not task-linked (T10).
Tilth already has linkedTaskId (B6) but doesn't suggest it.

**How it works:** On `focus.start` with no linkedTaskId, show a chip:
"Link to today's top priority: [task]". On `focus.end(id, true)` for a work
session linked to a task, offer a one-tap complete.

**Advantages:** Connects Execute to Prioritize; zero new data model.

**Limitations:** User may not want to complete the task after the session;
must be an offer, not automatic.

**Complexity:** Low (dashboard priority + focus UI chip).

**Validation:** Track link rate and session→completion conversion.

---

## 4. Digest-driven "shutdown checklist" (evidenced)

**Concept:** Evening digest (already exists, B14) gains an optional shutdown
ritual: review completedToday, mark stillOpen tasks for tomorrow, close focus.
Modeled on Sunsama's end-of-day review, which users praise (P12).

**User problem:** Work bleeds into evening; no clean stop → burnout.

**Why alternatives fail:** Sunsama's ritual is good but $22/mo and mobile-weak;
Tilth can offer it free and offline.

**How it works:** Evening digest surface adds "close the day" — a checklist:
completed count, still-open → tomorrow, focus minutes vs target. One action
marks the day reviewed.

**Advantages:** Uses existing digest engine; addresses work-life balance
(Deliverable Phase 4 job 14).

**Limitations:** Only valuable if users do it; optional.

**Complexity:** Low (UI over existing digest data).

**Validation:** Track "day reviewed" cadence; correlate with next-day capture.

---

## 5. Note-to-task extraction from markdown (hypothesis)

**Concept:** Scan a note's body for markdown task syntax (`- [ ]`) and offer to
create tasks from unchecked items, pre-filled with the note as context.

**User problem:** Notes capture ideas that should become tasks; manual
copy-paste is friction.

**Why alternatives fail:** Notion can do this but is slow/heavy for quick
notes (P1); Todoist has no notes.

**How it works:** In the note editor, a "create tasks from checklist" action
parses `- [ ]` lines and calls tasks.add with title + linkedTaskId = note id.

**Advantages:** Reuses existing notes.mdToHtml-adjacent parsing; no new model.

**Limitations:** False positives on code blocks; must scope to task lines.

**Complexity:** Low-Medium (small parser; already have markdown handling).

**Validation:** Track extraction usage; confirm few deletions/undos.

---

## 6. Weekly "time allocation" review from focus + tasks (evidenced)

**Concept:** Combine focusMinutesByDay (B12) + taskCompletionsByDay into a
weekly "where did my time go" view: planned vs actual, by day. Honest claims
with data floors (already the insights philosophy).

**User problem:** Users don't know where time goes; RescueTime does automatic
tracking but is separate (H-category).

**Why alternatives fail:** RescueTime is automatic but paid/SaaS; Tilth is local
and already has focus sessions + task completion times.

**How it works:** Weekly rollup of focus planned minutes vs completed task
counts, rendered as the existing recharts pattern with role="img" aria-labels.

**Advantages:** No new tracking; uses existing sessions + completedAt.

**Limitations:** Focus planned ≠ actual elapsed; must label as "planned focus
time" not "time tracked."

**Complexity:** Low (insights extension).

**Validation:** Track view frequency; qualitative feedback.

---

## 7. Template library for habits and tasks (evidenced)

**Concept:** Curated one-tap templates: "morning routine", "deep work block",
"weekly review" — pre-fill habit schedule or task with recurrence/due.

**User problem:** Users add too many habits then burn out (C4); templates
enforce a minimum, bounded start.

**Why alternatives fail:** Loop has no templates; Notion templates are heavy.

**How it works:** Template chips on new-habit and new-task forms; selecting one
fills the form in one tap (already the pattern for note templates, B8).

**Advantages:** Bounded, opinionated defaults combat the setup trap.

**Limitations:** Templates must be genuinely useful, not bloat.

**Complexity:** Low (data + UI chips; no engine change).

**Validation:** Track template adoption; retention of template-started habits.

---

## 8. Export-to-plain-text "life dashboard" print view (hypothesis)

**Concept:** A single printable/summary page: today's tasks, habits due, focus
target, digest line — designed to be printed or screenshot, not a dashboard.

**User problem:** Some users want a paper-like daily plan they can glance at
without opening the app.

**Why alternatives fail:** Nothing in the studied set offers a deliberate
print/summary view.

**How it works:** A `/today` print view using existing dashboard/digest data,
styled for print (CSS @media print), no interactivity.

**Advantages:** Zero new data; serves the "offline glance" need.

**Limitations:** Niche; print is declining.

**Complexity:** Low.

**Validation:** Low effort; ship and observe.

---

## 9. "Done list" reversal — celebrate completed, not pending (evidenced)

**Concept:** A dedicated view showing only what was completed today/this week,
with XP/coins earned, inverting the typical "what's left" anxiety.

**User problem:** Todo lists are shame lists of the undone; users feel
inadequate (C3/C4).

**Why alternatives fail:** Competitors center the pending list; completions
disappear or archive.

**How it works:** /done view (or dashboard section) listing completed tasks
today with completedAt, plus habits done and focus minutes. Celebratory but
quiet (matches Tilth tone).

**Advantages:** Positive reinforcement; uses xpLedger + completedAt already
stored.

**Limitations:** Could reduce urgency for remaining work; keep it secondary to
today's list.

**Complexity:** Low.

**Validation:** Track done-view usage vs. task-list usage.

---

## 10. Privacy-first local "AI summary" of the week (hypothesis)

**Concept:** Optional, fully local summary: "This week you completed N tasks,
focused M minutes, your best day was Tuesday." No external model, no keys,
no network — pure JS over the local snapshot.

**User problem:** Users want weekly insight without a cloud AI or subscription.

**Why alternatives fail:** Notion AI and others require accounts/subscriptions;
Tilth's insights engine is pure and local (B12).

**How it works:** A "weekly summary" button runs insights.insightsReport over
local data and renders plain text. Opt-in; nothing leaves the device.

**Advantages:** Addresses subscription fatigue + privacy (C5/C7); uses existing
pure engine.

**Limitations:** Less "smart" than an LLM summary; honest and limited is the
point.

**Complexity:** Low-Medium (UI over insights engine).

**Validation:** Track usage; qualitative "was this useful" prompt.

---

## Scoring summary

| Tier                            | Members                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Must-have (build first)         | C1, C2, O1, PR1, PL1, EX1, RV1, RV2, HA2, ST1, ST2 (mostly already in code or low-cost)                                                          |
| High-value differentiator       | PL3, O3, EX2, HA1, RW1                                                                                                                           |
| Innovative (prototype/validate) | C3, C4, PL2, P1 (energy plan), P2 (recovery day), P3 (focus-task bridge), P5 (note-to-task), P7 (templates), P9 (done list), P10 (local summary) |
| Low-priority (deferred)         | Team collaboration, heavy NLP, auto-rescheduling, location reminders, weekly-count habits, native apps                                           |
