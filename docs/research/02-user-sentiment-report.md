# Deliverable 2 — User Sentiment Report

Categorized report of what users love, dislike, request, and complain about
across the studied productivity products. Every quotation is drawn from a
traceable source in Deliverable 9; sources are cited inline with register IDs.
No quotations or review counts are fabricated. Where Reddit pages were
inaccessible directly, findings come from web-search snippets of those pages.

---

## A. What users love (indispensable experiences, not just appreciated features)

### 1. Speed of capture — "the app gets out of the way"

Users repeatedly name fast capture as the reason an app is enjoyable to open
and worth keeping.

- **Things 3:** "Opening Things on Mac is instant. Quick Entry pulls up in under
  a second from any app. Creating a task has no loading state. … After using
  subscription apps with their brief loading states, Things feels like cheating."
  (B2 / Asian Efficiency)
- **Todoist:** "The natural language processing is top tier! The quick capture
  feature is awesome, anything down now. Total game changer." (T7, Reddit
  r/todoist)
- **Todoist:** "the natural language input is a big one. Also, the near instant
  real time sync with Google Calendar." (T8, Reddit r/todoist)
- **Loop:** "So clean, simple and it only have what is needed." (H1, Google Play)

**Insight:** Capture speed is an _indispensable_ experience. A delay that
interrupts task capture is materially worse than a slightly annoying animation.
Tilth's quick-add parser and IndexedDB local-first writes directly address
this.

### 2. Calm, clean design that reduces decision fatigue

- **Things 3:** "Calm, polished interface with excellent gestures and keyboard
  navigation." "I like the fact only what I'm currently working on is on my
  current line of sight. There are not loads of different colours hitting me."
  (Nerdynav / App Store T4)
- **Things 3 review:** "It feels more coherent than TickTick because it is built
  around a smaller set of decisions."

**Insight:** Users love coherence — fewer decisions, not more features. Tilth's
olokch token system and progressive disclosure (advanced fields hidden in the
task editor) align with this.

### 3. Trust and data ownership

- **Loop:** "completely ad-free, open source and it respects your privacy" (H1).
- **Obsidian:** "your data always remains your own" (P5 / G2); "No account to
  start using … no pop-ups, no major overhauls" (P5).
- **Things 3:** one-time purchase; users keep it for years (B2: 4-year daily
  driver).

**Insight:** Trust is built by local data, no forced subscription, and stability.
Tilth's local-first IndexedDB model and optional encrypted sync are a direct
answer.

### 4. Forgiving habit design (streaks that don't punish)

- Users want streaks that don't break on a single missed day. Tilth's
  skip-limit recovery (max 2 skips/week) and "skipped neither breaks nor
  extends" rule (B5) directly matches the desire for gentle accountability.

### 5. Focus timer that can't be wrong

- Users value a timer that survives backgrounding/reloads. Tilth's
  timestamp-based `remainingMs` (B6/B7) is superior to TickTick's
  "Pomodoro timer stops in the background" complaint (T10).

---

## B. What users hate (friction with real consequences)

### 1. Complexity / feature overload / "setup trap"

- **Notion:** "Every feature was another decision, another potential
  optimisation, another reason to fiddle with the system instead of using it."
  (P4). "spend days tweaking icons and database relations only to realize they
  spend more time organizing their [work] than doing actual work" (P5).
- **ClickUp:** "too complicated for its main use"; "consistently missing the
  last 10-15% in every category"; "wasn't intuitive AT ALL" (P9/P10).
- **Amazing Marvin:** customization "clumsy and confusing … a lot to take in";
  "Omnifocus friction trap: a lot of clicking" (H7/H9).
- **TickTick:** feature expansion "can tempt you to spend more time configuring
  your system than completing tasks" (Nerdynav).

**Consequence:** Users abandon apps because _maintaining the system takes more
effort than the work itself_ (C2). Tilth should resist adding options nobody
asked for.

### 2. Slowness and startup friction

- **Notion:** "Notion isn't really designed for speed of thought. It's designed
  for the structure of thought." Too much friction for quick notes; "open-and-wait
  dance was killing the flow" (P1/P7). Mobile startup "horrible" (C2).
- **Consequence:** A slow app is not opened; capture thoughts are lost.

### 3. Subscription fatigue and cost

- **Todoist:** free plan "far too stingy" (T5); Pro $60/yr.
- **Motion:** $19–29/mo, no free plan, card-required trial; "budget-conscious
  users put off" (Medium P17).
- **Akiflow:** $34/mo; "unexpected charges and difficult cancellations" (P14).
- **General:** "Paying to rent a Utility feels like robbery" (C5); $390/yr
  across a typical toolkit (C7).

**Consequence:** Cost is a top cancellation reason. Tilth's free local-first
model is a strong retention and acquisition advantage.

### 4. Automation that feels invasive

- **Motion:** "AI shouldn't be moving all our stuff around simply based on
  variables like time and importance" (C1). "aggressive auto-rescheduling …
  invasive"; "packs their day too tightly, leaving no room for the unplanned
  work" (P17/P18).

**Consequence:** Users want _control_, not opaque automation. Tilth's
preference for predictable, explainable, optional automation (per the research
brief) matches this.

### 5. Gamification that fades / feels noisy

- **Habitica:** motivation "drops off once the newness dies off" (H4); can feel
  "noisy" for self-care (H4); bugs/crashes (H5).
- **Consequence:** Gamification works best as a short-term push, not the whole
  system. Tilth's XP/coins should stay lightweight and optional.

### 6. Platform lock-in and gaps

- **Things 3:** Apple-only, no web, no collaboration — dealbreaker for non-Apple
  or team users (PCMag T1).
- **Loop:** Android-only, no iPhone (H2).
- **Sunsama:** mobile app "isn't great"; not for offline/phone planning (P12).

### 7. Specific workflow bugs that erode trust

- **TickTick:** Pomodoro stops in background (T10); calendar can't create
  events (T12); inbox items reappear after dating (T13).
- **Habitica:** "rewards page disappears when I add a new reward, the app
  crashes … once a day" (H5).

**Consequence:** Lost work or broken core loops cause abandonment. Tilth's
debounced writes, soft delete + undo, and timestamp correctness guard against
this.

---

## C. Feature requests (with judgment)

| Request                          | Frequency                          | Segment            | Underlying problem               | Competitor solves?             | Simpler solution?                                                     | Tilth verdict                                          |
| -------------------------------- | ---------------------------------- | ------------------ | -------------------------------- | ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------ |
| Natural-language task entry      | High (Todoist praise)              | Power users        | Reduce capture fields            | Todoist (best-in-class)        | Inline `!flags`/`#tags` (Tilth quick-add already does this)           | Already covered; extend aliases, don't build heavy NLP |
| Calendar events (not just tasks) | Medium (TickTick complaints)       | Planners           | Tasks ≠ appointments on calendar | Google/Outlook (separate apps) | Treat time-blocked tasks as plan entries (Tilth plan page blockStart) | Partial; consider plan-page calendar integration       |
| Voice capture                    | Low-medium                         | Mobile users       | Hands-free capture               | —                              | —                                                                     | Opportunity (see Deliverable 5)                        |
| All-habits graph / categories    | Low (Loop request)                 | Habit users        | Aggregate view across habits     | —                              | Existing 12-week heatmap + consistency                                | Extend heatmap, don't add separate graph               |
| AI auto-scheduling               | Medium (Motion fans)               | Busy professionals | Manual planning burden           | Motion/Reclaim                 | Optional AI draft the user approves                                   | Optional, explainable automation (Deliverable 5)       |
| Habit categories/folders         | Low                                | Habit users        | Organize many habits             | —                              | Tags/filters already exist in tasks                                   | Low priority                                           |
| Offline mode                     | Medium (Notion/Sunsama complaints) | Travelers          | App unusable offline             | Notion limited, Sunsama none   | Tilth already offline-first                                           | Already covered; keep strong                           |

**Judgment:** Not every request is a good opportunity. Calendar-event creation
and voice capture are genuine gaps worth evaluating; heavy NLP and AI
auto-scheduling should remain optional and explainable to avoid the Motion-style
invasiveness users reject.

---

## D. Why users abandon (summary, with consequences)

1. **System maintenance > work** (C2, C3, C4): "keeping them up takes more
   effort than the work itself"; "productivity trap"; burned out tracking 5-6
   habits in a week. _Consequence: silent abandonment after 2-3 weeks._
2. **Slow startup / capture friction** (P1, P7, C2): lost fleeting thoughts;
   app simply stops being opened.
3. **Subscription cost** (C5, C7): $390/yr toolkit; cancellation for cost.
4. **Opaque/invasive automation** (P17, P18, C1): schedule rebuilt without
   consent; feels oppressive.
5. **Gamification decay** (H4, H5): novelty wears off; bugs erode trust.
6. **Platform lock-in** (T1, H2): Apple-only or Android-only apps are abandoned
   when the user's device ecosystem changes.
7. **Core-loop bugs** (H5, T10): crashes, lost rewards, broken timers — destroys
   trust quickly.

Tilth should deliberately avoid each of these (see Deliverable 3).
