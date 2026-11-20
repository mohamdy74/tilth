# Deliverable 7 — Prioritized Product Roadmap

Staged from the research. Dependencies and rationale explained per stage. The
roadmap intentionally excludes low-priority deferred items (team collaboration,
heavy NLP, auto-rescheduling, location reminders, weekly-count habits, native
apps).

Baseline (measured): 421 tests pass, typecheck 0 errors, lint 0 errors; tests
run 96.54s.

---

## Immediate improvements (this cycle)

These are low-complexity, high-confidence, mostly exposing or polishing what
already exists. No new systems.

| #   | Item                                                            | Why now                                                                      | Dependencies         |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------- |
| I1  | Extend quick-add aliases (more EN/AR date & priority words)     | Capture speed is the #1 loved experience (T7/T8); parser already exists (B3) | quickAdd.ts          |
| I2  | ⌘K global "capture anywhere" not tied to /tasks                 | Capture must work from any route; palette already routes (B4)                | sessionStorage flags |
| I3  | Surface task `notes` field in quick-add editor flow             | Context at capture; field already exists in model/editor (B4)                | tasks editor         |
| I4  | Improve saved-view discoverability (keyboard + prominent chips) | Users rebuild filters repeatedly; saved views exist (B4)                     | views API            |
| I5  | "Done today" celebratory strip on dashboard (secondary)         | Pending lists are shame lists (C3/C4); completions already stored            | dashboard data       |
| I6  | Habit streak-freeze discoverability in the today row            | Gentle accountability reduces burnout (H4/B5)                                | habits UI            |
| I7  | Weekly review digest (extend existing daily digest)             | Review is a core job (RV1); digest engine exists (B14)                       | digest.ts            |
| I8  | Focus distraction review surface (weekly pattern)               | Execute-Review link; distractions already captured (B6)                      | focusTime/history    |

Validation: each ships with its existing colocated test suite; no new test
infra.

---

## Next development cycle

| #   | Item                                                           | Why next                                                                                           | Dependencies                       |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------- |
| N1  | Energy-aware block suggestions on /plan (draft, user approves) | Uses existing insights completion-by-hour (B12); differentiates vs Motion's invasive auto-schedule | insights.ts + plan page            |
| N2  | Recovery day ("reset this week") for overdue backlog           | Directly addresses abandonment via backlog shame (C3/C4)                                           | tasks.update + habits.unlog + undo |
| N3  | Focus→task bridge: suggest/link top priority on session start  | Connects Execute to Prioritize; zero new model (linkedTaskId exists)                               | focus + todaysPriorities           |
| N4  | Note-to-task extraction from markdown checklists               | Notes→tasks friction; notes parser exists (B8)                                                     | notes.ts                           |
| N5  | Weekly time-allocation view (focus planned vs tasks done)      | Where-does-time-go job; uses existing sessions + completedAt                                       | insights.ts                        |
| N6  | Habit + task templates (one-tap bounded start)                 | Combats habit burnout from adding too many (C4)                                                    | habits.add / tasks.add             |

Validation: prototypes for N1/N2 flagged as hypotheses; measure acceptance /
usage before investing further.

---

## Medium-term capabilities

| #   | Item                                              | Rationale                                                  | Dependencies                       |
| --- | ------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| M1  | Voice-based capture (speech-to-text)              | Hands-free capture; major mobile gap                       | Web Speech API; mobile PWA         |
| M2  | Print / "life dashboard" glance view              | Offline glance; paper-like daily plan                      | CSS print; existing dashboard data |
| M3  | Habit stack / routine templates                   | Bounded habit starts                                       | template data                      |
| M4  | Local-first weekly AI summary (no external model) | Privacy + no subscription (C5/C7); insights engine is pure | insights engine                    |

---

## Long-term differentiators

| #   | Item                                                     | Rationale                                                      | Dependencies                        |
| --- | -------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------- |
| L1  | Encrypted remote sync polish (conflict UI, multi-device) | Local-first with optional sync; passphrase never leaves device | sync.ts exists; needs UX investment |
| L2  | Native iOS/Android app (beyond PWA)                      | Install distribution; app-store presence                       | PWA foundation exists               |

---

## Deliberately NOT on the roadmap (low priority / deferred)

- Team collaboration / shared lists — out of scope (personal, local-first).
- Heavy NLP parser — `!flags`/`#tags` already cover capture; dependency + latency not justified.
- AI auto-rescheduling of calendar — users reject invasive automation (Motion); violates optional/explainable principle.
- Location-based reminders — low frequency; permission/background complexity.
- Weekly-count habits ("3x/week") — out of scope v1; drives burnout.
- Weekly-count habits ("3x/week") — out of scope v1; drives burnout.
- Native iOS/Android app before PWA is solid — PWA covers install + offline.

---

## Stage gates

- **Immediate → Next:** All I-items shipped + tested; capture <3s baseline holds.
- **Next → Medium:** At least one innovative item (N1–N4) validated by usage
  metrics before M-items are scoped.
- **Medium → Long-term:** Sync and native only if local-first PWA retention is
  proven; never compromise the workerd SSR smoke gate (200 on `/` and
  `/settings`).
