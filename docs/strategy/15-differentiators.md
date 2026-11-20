# Tilth — Top Five Differentiators (Deliverable F)

These are the five improvements most likely to make Tilth meaningfully better,
not merely more feature-rich. Each is grounded in the competitor benchmark
(`docs/strategy/10-competitive-benchmark.md`), the user-sentiment findings
(`docs/research/02-user-sentiment-report.md`), and the actual implementation.

---

## 1. Capture speed that doesn't decay

**What it is:** One field, one Enter, from any route (`n` key, mobile FAB,
sidebar, ⌘K). Inline `!high #tag tomorrow` grammar (EN + Arabic) parsed
synchronously; the parse result is visible as live chips while typing so nothing
has to be remembered.

**Why it differentiates:** Todoist's NLP and Things 3's sub-second Quick Entry
are the most-loved capture experiences in the category; Notion's slow "open-and-wait
dance" is a top reason users abandon it. Tilth matches the speed without a
subscription, without an account, and without a backend.

**User value:** High — capture speed is the #1 loved experience and the #1
abandonment cause when slow.

**Engineering sustainability:** High — `parseQuickAdd` is pure and tested;
`QuickCapture` is a single modal reused from three entry points. No new
dependencies.

**Evidence:** Todoist praise (Reddit r/todoist: NLP "top tier", quick capture a
"total game changer"); Things 3 instant open (<1s, "feels like cheating");
Notion abandonment (slow startup, "open-and-wait dance killing the flow").

---

## 2. Recovery instead of guilt

**What it is:** When overdue tasks exist, the dashboard offers "Reset this week"
— one opt-in action that shifts overdue open tasks to today, recording previous
dueDates for an undo toast. It never deletes, never touches habits, never
re-dates anything due today or in the future. Habits use streak freeze and
skip-limit recovery (max 2 skips/week; unscheduled days never break).

**Why it differentiates:** Habit apps that punish a single miss (Habitica's
decaying motivation, rigid streaks) and backlog shame ("productivity trap") are
top abandonment reasons. Tilth treats a missed day as recoverable, not a
failure.

**User value:** High — directly addresses the #1 abandonment reason (backlog
shame / "keeping the app up takes more effort than the work").

**Engineering sustainability:** High — `recovery.resetWeek` is pure and tested;
soft delete + undo is the existing pattern across all destructive actions.

**Evidence:** Reddit r/productivity: "tools often get abandoned when keeping
them up takes more effort than the work itself"; habit burnout from tracking
5–6 habits in a week; Loop's appeal ("clean, simple, only what is needed").

---

## 3. A focus timer that can't be wrong

**What it is:** `remainingMs` is computed from stored timestamps vs wall clock
every render; the 500 ms interval only triggers re-render. It survives reloads,
background tabs, and sleeping phones; overdue sessions auto-complete on return.
Pause shifts `endsAt` forward. Completion plays a best-effort chime + vibration
(a tiny localStorage UI pref).

**Why it differentiates:** TickTick's Pomodoro stops in the background (an
unresolved Reddit bug); users abandon timers they can't trust. Tilth's
timestamp-based approach is fundamentally correct, not optimistically counted.

**User value:** Medium-High — timer correctness is a trust foundation; a broken
timer destroys trust permanently.

**Engineering sustainability:** High — no interval counting, no drift, no
blocking operations; tested in `focusTime.test.ts`.

**Evidence:** Reddit r/ticktick: "Pomodoro timer stops in the background";
Tilth design principle (AGENTS.md): "the countdown NEVER counts with interval
ticks."

---

## 4. Local-first data ownership, no subscription

**What it is:** No account, no subscription, data lives on-device in IndexedDB.
Optional encrypted remote sync (user-controlled endpoint or Tilth's route);
passphrase never leaves the device. ZIP export + JSON import with validation
before any write. `meta.lastExportedAt` drives a 7-day backup reminder.

**Why it differentiates:** Subscription fatigue is a top cancellation reason
($390/yr across a typical toolkit; "paying to rent a Utility feels like
robbery"). Tilth's free local-first model is a direct acquisition and retention
advantage. Competitors charge $60/yr (Todoist), $22/mo (Sunsama),
$34/mo (Akiflow), $19–29/mo (Motion).

**User value:** High — cost and data ownership are explicit reasons users
switch or never start.

**Engineering sustainability:** High — one IndexedDB key per collection, debounced
writes, no backend to maintain; sync is additive and optional.

**Evidence:** MainQuest/TechRT/GetCaptures on subscription fatigue; Things 3
one-time pricing praised (4-year daily driver); Loop ad-free/open-source
praised (4.9★, 63.7K reviews).

---

## 5. Arabic-first RTL as a native, intentional experience

**What it is:** Arabic is the default locale; SSR renders `<html lang="ar"
dir="rtl">`; English users flip in a hydration effect. Logical CSS props
throughout; directional icons get `rtl-flip`; Arabic line-height and
letter-spacing rules in `styles.css`; all copy hand-written per locale (never
machine-translated skeletons). recharts axes mirror in Arabic; ar-EG Arabic-Indic
digits throughout.

**Why it differentiates:** No major productivity app defaults to Arabic.
Tilth serves an underserved market natively, not as an afterthought.

**User value:** High for Arabic speakers; low marginal cost for the codebase
(since RTL is baked into the design system from the start).

**Engineering sustainability:** High — RTL is enforced by the AGENTS.md
architecture contract and the oklch token system; not a bolt-on layer.

**Evidence:** AGENTS.md architecture: "Arabic is the DEFAULT locale";
`src/styles.css` `:lang(ar)` rules; i18n dictionary EN+AR.

---

## Why these five together

They reinforce each other: fast capture makes the app worth opening; recovery
keeps users after a bad week; a trustworthy timer makes focus habitual; local
ownership removes the subscription barrier; Arabic-first opens an underserved
market. None requires a backend, a subscription, or a new module. Together they
form a coherent identity: **fast, forgiving, private, and inclusive — without
the setup trap.**
