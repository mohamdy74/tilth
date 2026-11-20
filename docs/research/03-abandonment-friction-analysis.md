# Deliverable 3 — Abandonment and Friction Analysis

Major reasons users stop using productivity applications, the design decisions
Tilth should make to avoid repeating those failures, and the evidence for each.
Sources map to Deliverable 9 (Evidence and Research Register).

---

## 1. The "productivity trap" — maintaining the system becomes the work

**Evidence:** Reddit r/productivity: "I spent years building complex Notion
setups only to realize I was just procrastinating with extra steps"; "there is
no perfect productivity setup … the actual work matters far more than
optimizing the tools" (C3). Reddit r/ProductivityApps: "keeping them up takes
more effort than the work itself" (C2). "the more I tracked, the less
consistent I became" tracking 5-6 habits (C4).

**Consequence:** Silent abandonment after 2–3 weeks of intense use; users
chase the next app instead of working.

**Tilth design decision:**

- **No blank-canvas onboarding.** Tilth ships with sensible defaults (dashboard
  cards, today/upcoming/overdue views, daily focus target) so the first minute
  is action, not configuration.
- **Progressive disclosure.** Advanced fields (recurrence, subtasks, notes,
  blockStart) live inside the task editor, not the quick-add bar. Quick add =
  title + optional `!flags`/`#tags`/date word.
- **No mandatory setup.** Nothing requires the user to configure before
  capturing a task. Settings are optional.
- **Measure "time in app" as a possible anti-metric.** If users spend long
  sessions configuring rather than completing, that's a smell, not a success.

---

## 2. Slow startup and capture friction — the thought is lost before it's saved

**Evidence:** Notion "open-and-wait dance was killing the flow" (P7); mobile
startup "horrible" (C2); "Notion isn't designed for speed of thought" (P1).
Things 3's instant open (<1s, no loading state creating tasks) is the positive
counter-example users cite (B2).

**Consequence:** Fleeting capture thoughts are lost; the app stops being opened.

**Tilth design decision (already in code):**

- Local-first IndexedDB; boot after hydration; skeletons until `ready` (B1).
- Quick-add bar on /tasks; ⌘K palette sets a sessionStorage flag and focuses
  the input on arrival (B4).
- `remainingMs` computed from timestamps, not interval ticks — timer never
  drifts after backgrounding (B6/B7).
- **Target:** task capture in <3 seconds from decision to saved (Deliverable 8).

---

## 3. Subscription fatigue and cost

**Evidence:** "Paying to rent a Utility feels like robbery" (C5); "$390/yr
across a typical toolkit" (C7); Todoist free plan "far too stingy" (T5); Motion
$19–29/mo no free tier (P17); Akiflow $34/mo with cancellation complaints
(P14). SaaS/productivity 22% cancellation rate (C6) — cost is a driver.

**Consequence:** Cancellation even when the app works; price-sensitive users
never start.

**Tilth design decision:**

- Free, local-first, no account, no subscription (architecture contract).
- Data never leaves the device; optional encrypted remote sync is user-configured
  and passphrase-protected (B17).
- Monetization (if ever) should follow "Generous Free Tier + Power User
  Upgrades" (C5), never rent core utility.

---

## 4. Opaque, invasive automation — the app "drives" without consent

**Evidence:** Motion: "AI shouldn't be moving all our stuff around simply based
on variables like time and importance" (C1); "aggressive auto-rescheduling …
invasive"; "packs their day too tightly … oppressive" (P17/P18); Reclaim can
"flood a calendar with events hard to remove" (P19).

**Consequence:** Users abandon automation they can't explain or undo; trust
erodes.

**Tilth design decision:**

- **Automation is optional, explainable, user-controlled.** No auto-rescheduling
  of the user's calendar. Any AI/suggestion produces a _draft the user approves_,
  never a silent mutation.
- Pure engines with no hidden state: rewards, streaks, insights, digest all take
  explicit inputs and return explicit results (architecture contract).
- Undo everywhere (toast with undo on complete/delete/archive).

---

## 5. Gamification that decays or feels noisy

**Evidence:** Habitica motivation "drops off once the newness dies off"; can
feel "noisy" for self-care (H4); bugs/crashes erase trust (H5: "app crashes …
once a day", rewards page disappears).

**Consequence:** Short-term novelty doesn't sustain retention; bugs kill it
faster.

**Tilth design decision:**

- XP/coins/level are lightweight and derived (no running totals), capped per day
  (DAILY_XP_CAP), never the main UI (B9).
- Achievements toast quietly; no loud fanfare.
- No streaks that punish a single miss — skip-limit recovery protects up to
  2 skips/week (B5).
- Gamification is a thin layer, never the core loop.

---

## 6. Platform lock-in and ecosystem gaps

**Evidence:** Things 3 Apple-only, no web/collaboration — dealbreaker (T1);
Loop Android-only (H2); Sunsama weak mobile/offline (P12).

**Consequence:** Users abandon when their device ecosystem changes or they need
offline.

**Tilth design decision:**

- PWA works on any device with a browser; installable; offline-first; precaches
  shell + fonts (B18).
- Arabic-first RTL is a deliberate, underserved niche (architecture contract).
- No accounts means no ecosystem lock-in; data is exportable as ZIP + JSON
  (B16).

---

## 7. Core-loop bugs — lost work, broken timers, disappeared data

**Evidence:** Habitica crashes and lost rewards (H5); TickTick Pomodoro stops in
background (T10); Notion data cloud-only/offline-limited (P1/P5).

**Consequence:** One lost-task incident destroys trust permanently.

**Tilth design decision:**

- Soft delete + undo on every destructive action (tasks, habits, notes,
  shop items, saved views).
- Import validates _before_ any write; a rejected file never touches existing
  data (B16).
- Sync merges per-record by `updatedAt`, never overwrites newer local data;
  conflicts are presented to the user for resolution (B17).
- Timestamp-based focus timer cannot be wrong after sleep/background (B6).

---

## 8. Habit burnout — tracking too much too soon

**Evidence:** "I would start motivated, add 5 or 6 habits, and then burn out
within a week" (C4).

**Consequence:** Abandonment of the habit module specifically.

**Tilth design decision:**

- Weekly-count habits out of scope v1 (architecture contract) — avoids the
  "3 times per week" complexity that drives burnout elsewhere.
- Streak freeze lets users protect streaks during known disruptions (B5).
- Dashboard habits card shows only habits _due today_ — bounded scope.

---

## Tilth anti-abortion checklist (apply to every new feature)

Before adding anything, confirm:

- [ ] Does it add a configuration step before first use?
- [ ] Does it slow capture below ~3 seconds?
- [ ] Does it require a subscription or account?
- [ ] Does it mutate data without an explicit user action + undo?
- [ ] Does it punish a single missed day?
- [ ] Does it work offline?
- [ ] Is it optional / hidden until needed?

Any "yes" is a reason to redesign or drop the feature.
