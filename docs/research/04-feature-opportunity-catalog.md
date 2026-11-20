# Deliverable 4 — Feature Opportunity Catalog

Prioritized potential features grouped by functional area, each supported by
evidence. Scoring considers: user impact, problem frequency, competitive
differentiation, strategic relevance, implementation complexity, maintenance
burden, performance risk, confidence. Priority: Must-have / High-value
differentiator / Innovative / Low-priority.

Evidence IDs reference Deliverable 9.

---

## Capture

| #   | Opportunity                                                                        | User problem                                                         | Evidence                                                              | Competitors     | Tilth advantage                            | Complexity | Perf risk | Priority   | Confidence |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------- | ------------------------------------------ | ---------- | --------- | ---------- | ---------- |
| C1  | Extend quick-add aliases (more EN/AR date/priority words)                          | Unknown `!flags` and date words stay in title; users must edit after | T7/T8 (Todoist NLP praised); B3 (Tilth already has parser)            | Todoist ★★★ NLP | Already built; alias extension is low-cost | Low        | Low       | Must-have  | High       |
| C2  | ⌘K palette "capture anywhere" from any route (global quick add not tied to /tasks) | Capture requires navigating to /tasks                                | T7 (quick capture = game changer); B4 (palette already routes)        | —               | One global capture entry point             | Low        | Low       | Must-have  | High       |
| C3  | Voice-based capture (speech-to-text task)                                          | Hands-free capture while walking/driving                             | C2 (capture speed indispensable); no major competitor does voice well | —               | Mobile PWA + Web Speech API                | Medium     | Low       | Innovative | Medium     |
| C4  | Capture from share sheet / browser extension                                       | Capture links and page highlights without switching apps             | P1 (Notion friction for quick notes)                                  | —               | PWA share target                           | Medium     | Low       | Innovative | Medium     |

## Organize

| #   | Opportunity                                              | User problem                            | Evidence                                                        | Competitors     | Tilth advantage                              | Complexity | Perf risk | Priority   | Confidence |
| --- | -------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------- | --------------- | -------------------------------------------- | ---------- | --------- | ---------- | ---------- |
| O1  | Task notes field already exists; surface it in quick add | Users want to attach context at capture | B4 (notes field exists in editor)                               | Todoist         | Already in model; expose in editor           | Low        | Low       | Must-have  | High       |
| O2  | Saved views improvements (share view, view shortcuts)    | Users rebuild filters repeatedly        | B4 (saved views exist)                                          | Todoist filters | Named, reusable, keyboard accessible         | Low        | Low       | High-value | High       |
| O3  | Projects / areas grouping beyond tags                    | Flat task list gets unwieldy            | P4 (Notion databases overkill); Things 3 areas/projects praised | Things 3        | Lightweight grouping, no database complexity | Medium     | Low       | High-value | High       |

## Prioritize

| #   | Opportunity                                             | User problem                         | Evidence                                      | Competitors        | Tilth advantage               | Complexity | Perf risk | Priority   | Confidence |
| --- | ------------------------------------------------------- | ------------------------------------ | --------------------------------------------- | ------------------ | ----------------------------- | ---------- | --------- | ---------- | ---------- |
| PR1 | AI-assisted priority suggestion (optional, explainable) | Users over-prioritize everything     | P4 (setup trap from too many decisions)       | —                  | Optional draft, user approves | Medium     | Medium    | Innovative | Medium     |
| PR2 | "Start today" / "Do next" single-action surface         | Decision fatigue on what to do first | B4 (digest firstTask); C3 (productivity trap) | Sunsama objectives | One-tap decision surface      | Low        | Low       | Must-have  | High       |

## Plan

| #   | Opportunity                                                             | User problem                                      | Evidence                                                   | Competitors                | Tilth advantage                         | Complexity   | Perf risk | Priority   | Confidence |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------- | -------------------------- | --------------------------------------- | ------------ | --------- | ---------- | ---------- |
| PL1 | Time-blocking plan page (exists) — make it the default planning surface | Tasks need a time, not just a date                | P15 (Things 3 can't time-block); TickTick calendar praised | TickTick, Sunsama          | Already built (blockStart); local-first | Low (exists) | Low       | Must-have  | High       |
| PL2 | Optional AI daily-plan draft (user approves)                            | Manual planning is slow; Motion is too aggressive | P17/P18 (Motion invasiveness rejected); C4                 | Motion (rejected), Reclaim | Draft-only, never auto-reschedules      | High         | Medium    | Innovative | Medium     |
| PL3 | Realistic workload estimation (don't over-schedule a day)               | Users over-commit                                 | P18 (Motion over-scheduling)                               | —                          | Pure math from estimated minutes        | Low          | Low       | High-value | High       |

## Execute

| #   | Opportunity                                                            | User problem                       | Evidence                                                | Competitors | Tilth advantage                           | Complexity | Perf risk | Priority   | Confidence |
| --- | ---------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------- | ----------- | ----------------------------------------- | ---------- | --------- | ---------- | ---------- |
| EX1 | Focus timer improvements (break suggestions, session linking to tasks) | Focus disconnected from task list  | B6 (linkedTaskId exists); T10 (TickTick background bug) | —           | Timestamp-correct timer already superior  | Low        | Low       | Must-have  | High       |
| EX2 | Distraction review (log distractions, weekly pattern)                  | Users don't know what breaks focus | B6 (distractions array per session)                     | RescueTime  | Already captured; needs reporting surface | Medium     | Low       | High-value | Medium     |

## Review

| #   | Opportunity                                                               | User problem                                   | Evidence                                        | Competitors           | Tilth advantage                | Complexity | Perf risk | Priority  | Confidence |
| --- | ------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------- | --------------------- | ------------------------------ | ---------- | --------- | --------- | ---------- |
| RV1 | Weekly review digest (morning/evening already exist) — add weekly cadence | Users need periodic reflection, not just daily | B14 (digest exists daily); C3 (review sessions) | Sunsama weekly review | Extend digest to weekly        | Low        | Low       | Must-have | High       |
| RV2 | Insights observations already exist; add exportable weekly report         | Users want to review progress over time        | B12 (insights with data floors)                 | —                     | Honest claims with data floors | Low        | Low       | Must-have | High       |

## Habits & routines

| #   | Opportunity                                              | User problem                                 | Evidence                                       | Competitors | Tilth advantage                        | Complexity | Perf risk | Priority   | Confidence |
| --- | -------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------- | ----------- | -------------------------------------- | ---------- | --------- | ---------- | ---------- |
| HA1 | Habit stack / routine templates                          | Starting a habit is hard; users add too many | C4 (burnout from 5-6 habits); H4               | —           | Templates keep it bounded              | Low        | Low       | High-value | High       |
| HA2 | Streak freeze already exists; surface in UI more clearly | Users fear breaking streaks                  | B5 (freeze exists); H4 (gentle accountability) | —           | Already built; improve discoverability | Low        | Low       | Must-have  | High       |

## Rewards / shop / achievements

| #   | Opportunity                                        | User problem       | Evidence                               | Competitors | Tilth advantage           | Complexity   | Perf risk | Priority  | Confidence |
| --- | -------------------------------------------------- | ------------------ | -------------------------------------- | ----------- | ------------------------- | ------------ | --------- | --------- | ---------- |
| RW1 | Keep shop/achievements lightweight (already built) | Gamification decay | H4/H5 (Habitica bugs, motivation fade) | Habitica    | Derived, capped, optional | Low (exists) | Low       | Must-have | High       |

## Settings / customization

| #   | Opportunity                              | User problem                         | Evidence                  | Competitors | Tilth advantage          | Complexity   | Perf risk | Priority  | Confidence |
| --- | ---------------------------------------- | ------------------------------------ | ------------------------- | ----------- | ------------------------ | ------------ | --------- | --------- | ---------- |
| ST1 | Dashboard card visibility already exists | Cluttered dashboard                  | B7 (cards toggleable); C3 | —           | Already built            | Low (exists) | Low       | Must-have | High       |
| ST2 | Accent themes already exist              | Visual customization without clutter | B17 (themes)              | —           | Already built; 5 accents | Low (exists) | Low       | Must-have | High       |

---

## Low-priority ideas (explicitly deferred)

| Idea                              | Reason deferred                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| Team collaboration / shared lists | Explicitly out of scope (personal, local-first); adds sync complexity                 |
| Heavy NLP parser                  | Tilth's `!flags`/`#tags` already cover capture; heavy NLP adds dependency and latency |
| AI auto-rescheduling of calendar  | Users reject invasive automation (Motion); violates optional/explainable principle    |
| Location-based reminders          | Low frequency; adds permission/background complexity                                  |
| Weekly-count habits ("3x/week")   | Out of scope v1 (architecture contract); drives burnout                               |
| Native iOS/Android app            | PWA covers web/install; native is a later investment                                  |
