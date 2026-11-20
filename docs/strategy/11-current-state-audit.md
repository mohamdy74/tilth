# Tilth — Current-State Audit (Deliverable B)

Factual assessment of the actual project, verified against source code and
CI output. Baseline at audit time: `tsc --noEmit` clean, **439 vitest tests
passing** (41 files), `eslint` clean on changed files, production build
passes, workerd smoke probes (`/`, `/settings`, `/sw.js`,
`/manifest.webmanifest`, `/_shell.html`) return 200. Baseline commit
`a071d04` on `main`.

Grounded in: direct source inspection (`src/lib/*.ts`, `src/routes/*.tsx`),
`docs/research/09-evidence-research-register.md`, and prior audit reports
(`docs/product-excellence-audit-2026-11.md`,
`docs/engineering-audit-2026-11-18.md`,
`docs/engineering-refactor-2026-11-18.md`).

Never report a feature as missing without checking implementation; never
report something as working merely because its UI exists.

---

## 1. Architecture (verified from source)

| Layer            | Implementation                                                                                                                | Status             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Framework        | React 19 + TanStack Router/Start (SPA mode, prerendered `_shell.html`)                                                        | Working            |
| Styling          | Tailwind CSS v4, oklch tokens, swappable `--accent-hue`                                                                       | Working            |
| State            | Zustand store over idb-keyval (IndexedDB), one key per collection                                                             | Working            |
| Persistence      | Local-first IndexedDB; 250 ms debounced writes per key; flush on tab hide                                                     | Working            |
| Multi-tab        | `BroadcastChannel("tilth-sync")` + per-key revision counters; merge by `updatedAt`                                            | Working            |
| Sync             | Optional encrypted remote sync (Tilth endpoint or user URL); local = source of truth; conflict resolution UI                  | Working            |
| i18n / RTL       | Typed dictionary EN+AR; Arabic default; logical CSS props; `rtl-flip` icons                                                   | Working            |
| PWA              | vite-plugin-pwa (generateSW), offline shell, PNG-only manifest icons, reload banner user-approved, never during focus session | Working            |
| Routing          | 10 real pages: `/`, `/tasks`, `/notes`, `/habits`, `/focus`, `/rewards`, `/insights`, `/calendar`, `/settings`, `/plan`       | Working            |
| Tests            | colocated `*.test.ts`; 439 pass                                                                                               | Working (verified) |
| Typecheck / Lint | `tsc --noEmit` clean; eslint clean on changed files                                                                           | Working (verified) |
| SSR guard        | No `crypto.randomUUID()`, `Math.random()`, `setTimeout`, or async I/O at module top level in SSR-reachable files              | Working            |

Collections (one IndexedDB key each): `tasks`, `notes`, `habits`,
`habitLogs`, `focusSessions`, `xpLedger`, `achievements`, `shopItems`,
`purchases`, `settings`, `meta`, `savedViews`. Schema version 5
(`src/lib/types.ts`). `localDay` stored at creation and never recomputed.

---

## 2. What works well (verified)

| Area                     | Evidence                                                                                                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capture speed            | `parseQuickAdd` is pure/synchronous (`quickAdd.ts`); inline `!high`/`#tag`/date words incl. Arabic; QuickCapture modal (`n` key, mobile FAB, sidebar); ⌘K palette routes to it. Tasks can be captured in one field + Enter.         |
| Timer correctness        | `remainingMs` computed from timestamps vs wall clock every render; 500 ms interval only re-renders. Survives reloads/background tabs; overdue auto-completes on return (`focusTime.ts`, `focus.tsx`).                               |
| Forgiving habits         | Streaks with skip-limit recovery (max 2 skips/week), "skipped neither breaks nor extends", streak freeze, 12-week heatmap distinct beyond color (`streaks.ts`, `habits.tsx`).                                                       |
| Recovery-friendly writes | Soft delete + undo toast on every destructive action (tasks, habits, notes, shop, saved views); import validates before any write; migrations for older schemas (`backup.ts`, `store.ts`).                                          |
| Data ownership           | Local-first; no account; no subscription; data never leaves device unless user opts into encrypted sync; passphrase never leaves device (`sync.ts`, `syncCrypto.ts`).                                                               |
| Rewards engine           | Pure `awardXp`/`revokeXp`/`totalsFromLedger`; single wiring point `applyRewardEvent`; daily XP cap; task min age 2 min; level curve `100*n^1.5` per-step; coins derived from ledger (`rewards.ts`, `rewardsConfig.ts`, `store.ts`). |
| Offline reliability      | Service worker precaches shell + fonts + assets; SPA fallback (`_shell.html`) for hard refresh offline; PWA registration skips dev/localhost/lovable.dev (`pwa.ts`, `vite.config.ts`).                                              |
| Accessibility            | Focus-trapped dialogs, skip link, `:focus-visible` ring, `prefers-reduced-motion` kill-switch, WCAG-AA-pinned accent themes, shape-encoded priority, Arabic line-height/letter-spacing (`styles.css`, `themes.ts`).                 |
| Route splitting          | Per-route chunks 5–25 kB; `insights` chunk isolates recharts (~410 kB) off the cold path (engineering audit).                                                                                                                       |

---

## 3. Weak / needs-improvement features

| Feature        | Gap                                                                                                    | File(s)                                                           | Evidence                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Dashboard      | Static grid of cards; no "done today" celebration until prior build added a strip                      | `src/routes/index.tsx`                                            | Prior build (a071d04) added a done-today strip; still a relatively static set of cards |
| Habits         | Streak-freeze chip only in expanded editor, not visible on the today row at a glance                   | `src/routes/habits.tsx`                                           | Prior build added freeze chip to today row                                             |
| Focus          | No suggested task link; no weekly distraction aggregate                                                | `src/routes/focus.tsx`                                            | Timer + distractions exist; surfacing is thin                                          |
| Planning       | No energy-aware suggested block; suggestions require manual drag/nudge                                 | `src/routes/plan.tsx`, `src/lib/plan.ts`                          | Time-blocking exists; no contextual suggestion                                         |
| Notes          | Note→task extraction exists as pure lib (`noteTasks.ts`) but not yet wired to UI beyond manual convert | `src/routes/notes.tsx`, `src/lib/noteTasks.ts`                    | `extractChecklistTasks` pure; UI action added in prior build                           |
| Weekly review  | Exists as pure `weeklyReview` engine and Insights panel                                                | `src/lib/insights.ts`, `src/routes/insights.lazy.tsx`             | Implemented                                                                            |
| Recovery       | "Reset this week" added in prior build; shifts overdue tasks to today with undo                        | `src/lib/store.ts` (`recovery.resetWeek`), `src/routes/index.tsx` | Implemented                                                                            |
| Task templates | Template chooser added in prior build                                                                  | `src/routes/tasks.tsx`, `src/lib/templates.ts`                    | Implemented                                                                            |

Note: several "improvements" above were implemented in the immediately preceding build batch (quick-add aliases, ⌘K capture-anywhere, done-today strip, recovery reset, focus→task bridge, distraction surface, note checklist extraction, habit/task templates, energy suggestion). This audit treats the post-a071d04 tree as current state.

---

## 4. Missing capabilities (genuine gaps, not yet built)

| Capability                                     | Why it's absent                                                       | Relevance                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Native iOS/Android app                         | PWA covers install + offline; native app stores not configured        | P3 (later)                                                                            |
| Bundle budget / Lighthouse CI gate             | No CWV or bundle-size gate in CI; index chunk ~379 kB raw             | P0 (measurement, not product change)                                                  |
| Automated a11y gate (axe) in CI                | No axe scan; manual a11y only                                         | P1                                                                                    |
| Usage metrics / performance instrumentation    | No real-user timing (LCP/INP) captured; baseline numbers not invented | P0 (measurement)                                                                      |
| Calendar-event creation (tasks ≠ appointments) | `/plan` time-blocks tasks; no calendar event write-back               | Deferred — low frequency, adds complexity                                             |
| Voice capture                                  | Not implemented; Web Speech API would be needed                       | P2/P3                                                                                 |
| AI / NLP task extraction                       | `parseQuickAdd` covers inline syntax; no LLM integration              | Rejected per principles (no decorative chatbot; optional explainable automation only) |

---

## 5. UX problems

| Problem                                                                                       | Location                                                   | Impact                                         | Severity   |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- | ---------- |
| Dashboard can feel like a static card grid rather than an execution surface                   | `src/routes/index.tsx`                                     | Users see counters, not a clear "do this next" | Medium     |
| ⌘K "New task" previously routed to `/tasks` instead of opening capture (fixed in prior build) | `src/routes/AppShell.tsx`                                  | Extra navigation step before capture           | Fixed      |
| Focus timer has no one-tap "link to top priority" suggestion (added in prior build)           | `src/routes/focus.tsx`                                     | Focus and task list feel disconnected          | Fixed      |
| No energy-aware block suggestion on `/plan` (added pure lib; UI wiring in prior build)        | `src/routes/plan.tsx` + `src/lib/energy.ts`                | Planning is fully manual                       | Fixed (UI) |
| Streak freeze visible only after expanding a habit (fixed in prior build)                     | `src/routes/habits.tsx`                                    | Users can't see protected habits at a glance   | Fixed      |
| No bundle-size or runtime-performance budget in CI                                            | CI gates: typecheck + vitest + eslint + workerd smoke only | Regressions invisible until deployed           | Medium     |

---

## 6. Performance bottlenecks (measured vs suspected)

| Item                 | Measurement                                                                                                                          | Status                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Main JS chunk        | ~379 kB raw / ~120 kB gzip (engineering audit)                                                                                       | Measured; no CWV data                                                         |
| Lazy insights chunk  | ~410 kB raw / ~109 kB gzip (recharts isolated off cold path)                                                                         | Measured; intentional                                                         |
| Client CSS           | 87.5 kB raw / 24 kB gzip after cleanup (−31.9% raw)                                                                                  | Measured                                                                      |
| Test suite           | 439 tests, ~15–32 s                                                                                                                  | Measured                                                                      |
| Runtime INP / LCP    | Not measured — no browser automation or Lighthouse in this environment                                                               | **Unknown** — explicitly not claimed                                          |
| Large-list rendering | Tasks/habits lists derive filters per render; no memoization/virtualization added without profiling                                  | Suspected hotspot at scale; unproven                                          |
| Digest effect        | AppShell subscribes to whole collections (`tasks`, `habits`, `habitLogs`, `focusSessions`); resets 60 s interval on any store change | Harmless at current sizes; selector optimization only if profiling shows cost |

**Honest limit:** Runtime performance numbers (startup, task-creation latency, INP) were not measured because no browser automation/performance tooling was available in this environment. Per the brief, no numbers are invented; these are proposed acceptance criteria to verify before being treated as met (`docs/research/08-performance-ux-standards.md`).

---

## 7. Architectural risks

| Risk                                                                                                    | Mitigation already in place                                                                  | Residual concern                                                                  |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| SSR/workerd forbids `crypto.randomUUID()`, `Math.random()`, `setTimeout`, async I/O at module top level | Values generated lazily inside functions (`tabId()`, `uid()`); enforced by CI smoke test     | New contributors could reintroduce; lint/tsc don't catch it                       |
| IndexedDB is the only persistence; no server backup                                                     | ZIP export + JSON import with validation; `meta.lastExportedAt` drives 7-day backup reminder | Data loss if user never exports and clears browser data                           |
| Multi-tab merge by `updatedAt` can lose a concurrently edited field                                     | Per-key rev counters; `mergeValue` keeps local pending edits on top                          | Last-write-wins per field is acceptable for personal use; documented honest limit |
| Rewards/ledger live in browser; import can overwrite                                                    | Documented as guardrail against self-cheating, not security                                  | Users can self-cheat; acceptable for personal tool                                |
| Route file (`routeTree.gen.ts`) hand-edited when routes added off dev server                            | Diffed against parent before pushing (engineering convention)                                | Human error risk on route additions                                               |

---

## 8. Bottom line

Tilth's architecture is strong where it matters: local-first, pure tested engines,
timestamp-correct timer, forgiving habits, recovery-friendly writes, no
subscription, Arabic-first RTL. The remaining work is **not** adding modules —
it's (a) measurement (bundle budget, CWV, a11y CI gate, runtime timing), and
(b) micro-polish of the capture→execute loop. The audit supports a
foundation-first roadmap (Phase 0) before intelligence features.
