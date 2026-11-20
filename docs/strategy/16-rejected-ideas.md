# Tilth — Rejected Ideas (Deliverable G)

Attractive features that should **not** be built yet (or ever), with the reason
each fails the final decision standard: User Value, Experience Quality,
Engineering Sustainability. Grounded in the brief's "Features to Avoid" list
and the competitor/sentiment evidence.

---

## 1. Team collaboration / shared lists

**Why it sounds appealing:** Todoist, Asana, ClickUp, Trello all have it;
collaboration is a common request.

**Why rejected:** Tilth is explicitly personal and local-first (AGENTS.md:
"no backend/accounts; app data will live on-device"). Collaboration requires
a server, conflict resolution at scale, user accounts, and real-time sync —
directly contradicting the documented local-first decision. It would also
introduce the complexity Tilth avoids (permissions, presence, activity feeds).

**Verdict:** Rejected. Not in scope for any phase.

---

## 2. AI auto-rescheduling of the calendar (Motion-style)

**Why it sounds appealing:** Motion auto-builds and rebuilds your schedule;
sounds like it removes planning effort.

**Why rejected:** Users explicitly reject invasive automation. Reddit: "AI
shouldn't be moving all our stuff around simply based on variables like time and
importance"; "aggressive auto-rescheduling ... invasive"; "packs their day too
tightly ... oppressive." It requires a calendar backend and write access —
contradicting local-first. Tilth's principle: suggestions are drafts the user
approves; nothing moves without consent.

**Verdict:** Rejected. Opt-in suggestions only (energy block, recovery reset —
both undoable).

---

## 3. Heavy NLP parser / standalone AI chatbot

**Why it sounds appealing:** Todoist's natural-language input is praised; AI
chatbots are trendy.

**Why rejected:** Tilth's `parseQuickAdd` already covers inline `!flags`/`#tags`/
date words synchronously with zero dependencies. A heavy NLP parser adds latency,
a dependency, and opacity. A decorative chatbot solves no real workflow and
violates "AI must solve a real problem, not exist as a decorative chatbot."
Any AI assistance must be predictable, explainable, optional, and user-controlled.

**Verdict:** Rejected (heavy NLP/chatbot). Inline grammar stays; optional
explainable automation only if evidence justifies it.

---

## 4. Complicated gamification / excessive badges and rewards

**Why it sounds appealing:** Habitica's RPG loop is engaging for some users;
gamification drives short-term motivation.

**Why rejected:** Gamification motivation "drops off once the newness dies off"
and can feel "noisy" for self-care (Everyday.app). Habitica is "messy and
difficult to navigate" with reported crashes (App Store). Tilth's XP/coins/level
are lightweight, derived (no running totals), capped per day
(`DAILY_XP_CAP`), and never the main UI. Streaks don't punish a single miss
(skip-limit recovery).

**Verdict:** Rejected (complicated gamification). Lightweight rewards stay;
no new badges, no leaderboard, no social feed.

---

## 5. Social productivity feeds

**Why it sounds appealing:** Social accountability can motivate.

**Why rejected:** Explicitly in the brief's "avoid" list. A personal, local-first
tool has no social graph; adding one requires a backend, moderation, and
privacy considerations that contradict Tilth's identity.

**Verdict:** Rejected. Not considered further.

---

## 6. Calendar-event creation (writing appointments, not tasks)

**Why it sounds appealing:** Users want tasks and appointments on one calendar;
TickTick users complain it can't create calendar events.

**Why rejected:** Low frequency; adds permission/background complexity and a
calendar backend. Tilth time-blocks tasks on `/plan`; it is not a calendar app.
The distinction (task vs appointment) is intentional.

**Verdict:** Deferred (not rejected forever, but out of scope; revisit only on
strong, repeated demand).

---

## 7. Location-based reminders

**Why it sounds appealing:** "Remind me when I get home" is a classic feature.

**Why rejected:** Low frequency for a personal tool; requires location
permissions and background geolocation — complexity and privacy surface for
marginal benefit. Not requested in the evidence.

**Verdict:** Rejected for v1–v2; low priority thereafter.

---

## 8. Weekly-count habits ("3 times per week")

**Why it sounds appealing:** Flexible habit cadence is a common request.

**Why rejected:** Explicitly out of scope for v1 (AGENTS.md: "Weekly-count
habits ... are out of scope for v1"). It adds denominator complexity and drives
the habit-burnout abandonment path (users tracking too many, burning out in a
week).

**Verdict:** Deferred (out of scope v1).

---

## 9. Decorative 3D animations / unnecessary motion

**Why it sounds appealing:** Makes a demo look impressive.

**Why rejected:** Explicitly in the "avoid" list. Tilth values smoothness and
`prefers-reduced-motion`; animations must not delay user actions. The existing
timer/progress-ring transitions are functional and brief.

**Verdict:** Rejected. Animation is functional, brief, and respects
reduced-motion.

---

## 10. Hundreds of configuration options / full modular personalization

**Why it sounds appealing:** Notion/Obsidian-style "build your own system"
appeals to power users.

**Why rejected:** The setup trap is a top abandonment reason (users configure
instead of working). Every setting is a tax on the default experience. Tilth's
existing toggles (dashboard cards, accent, language, theme, dayStartHour,
digest) already provide personalization without a settings maze.

**Verdict:** Deferred (existing toggles suffice; add only on specific evidence).

---

## 11. Push notifications / server sync as default

**Why it sounds appealing:** Cross-device and re-engagement.

**Why rejected:** Tilth is local-first with no backend; the digest uses the
local Notification API while the app is open (no push server, none planned).
Encrypted remote sync is opt-in and user-configured. Push would require a
server and contradict the architecture.

**Verdict:** Rejected as default; encrypted sync is optional and additive.

---

## 12. Native iOS/Android app (before PWA is proven)

**Why it sounds appealing:** App-store distribution.

**Why rejected:** The PWA is installable, works offline, and covers all routes.
Native apps are a separate build/release channel and add maintenance. Build
only if PWA retention is proven.

**Verdict:** Deferred (Phase 4 candidate, gated on PWA retention).

---

## 13. Full Notion / Obsidian replacement (knowledge OS)

**Why it sounds appealing:** "One app for everything" is a common pitch.

**Why rejected:** Notion's setup trap and mobile lag are abandonment reasons;
Obsidian's steep learning curve and paid sync are friction. Tilth's notes are
task-adjacent (`linkedTaskId`, checklist extraction), not a knowledge OS.
Recreating linked docs, bidirectional linking, or graph view competes on
others' turf and adds a subsystem Tilth doesn't need.

**Verdict:** Rejected. Notes stay lightweight and task-connected.

---

## Decision standard applied

Each rejected idea fails at least one of the three tests:

| Test                       | Meaning                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------- |
| User Value                 | Solves a meaningful, evidenced problem?                                             |
| Experience Quality         | Makes Tilth more intuitive, enjoyable, efficient?                                   |
| Engineering Sustainability | Implementable without compromising speed, reliability, simplicity, maintainability? |

If an idea fails any test, it does not enter the roadmap merely because it
sounds impressive or a competitor has it.
