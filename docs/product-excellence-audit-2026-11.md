# Tilth — Product Excellence Audit (2026-11-15)

Evidence-based assessment of the app as it stands, a competitive gap analysis, and a
prioritized roadmap. Baseline at audit time: `tsc --noEmit` clean, 286/286 vitest tests
green, production build succeeds; git history shows prior audit passes (TIL-F*, a11y P3,
phase 2/3 UX audits), so this audit focuses on what remains.

## 1. Product audit — current state

**Architecture (verified from source):** React 19 + TanStack Router/Start (SPA mode,
prerendered `_shell.html`), Tailwind v4, zustand store over idb-keyval (IndexedDB),
local-first with no backend, BroadcastChannel multi-tab sync, Arabic-first RTL with
typed i18n dictionary, oklch design tokens with a swappable `--accent-hue`, self-hosted
@fontsource fonts, PWA via vite-plugin-pwa + hand-regenerated `sw.js`.

**Strengths (evidence):**
- Real pages for every nav section; route-level code splitting works — measured build:
  `index-*.js` 492 kB, per-route chunks 5–25 kB, `insights-*.js` 402 kB isolates all of
  recharts (515 kB raw) off the cold path.
- Pure, tested domain engines (`streaks`, `weekView`, `digest`, `rewards`, `insights`,
  `quickAdd` …) with 24 test files; timer correctness is timestamp-based, not tick-based.
- Accessibility already handled deliberately: focus-trapped dialogs, skip link,
  `:focus-visible` ring, `prefers-reduced-motion` kill-switch, WCAG-AA-pinned accent
  themes, shape-encoded priority (not color-only), Arabic line-height/letter-spacing rules.
- Offline correctness is engineered, not assumed: SW precache regenerated against the
  final build output with a self-check (`scripts/postbuild-sw.mjs`), SPA fallback for
  hard refreshes offline, PNG-only manifest icons.

**Weaknesses / opportunities found in this pass:**
1. [LOW, fixed] Legacy `.woff` font fallbacks (~135 kB across 3 files) were precached by
   the service worker even though every SW-capable browser supports woff2 — same
   dead-weight class as the documented DOWNFORCE icon lesson.
2. [MEDIUM] Initial JS is ~492 kB raw (index chunk). No evidence yet of a real-world
   problem (gzip much lower, route chunks split), but no bundle budget or Lighthouse CI
   exists either — measurement gap, not a proven defect.
3. [MEDIUM] No automated a11y gate (axe) or CWV measurement in CI; only typecheck,
   vitest, eslint, and a workerd smoke test run.
4. [LOW] AppShell subscribes to whole collections (`tasks`, `habits`, `habitLogs`,
   `focusSessions`) for the digest effect, so any store change re-runs that effect and
   resets its 60 s interval. Harmless at current data sizes; worth a targeted selector
   only if profiling shows re-render cost.

## 2. Competitive gap analysis (principle-level)

| Product | What it does best | Transferable principle | Fits Tilth? |
|---|---|---|---|
| Todoist | Natural-language quick add, multiple views | Tilth already has quick-add parsing (`quickAdd.ts`) + list/kanban views | Covered |
| Things 3 | Frictionless capture; Today as the default surface | Tilth's `/` dashboard + quiet digest already do this | Covered |
| Linear | Keyboard-first everything, instant palette, triage flow | ⌘K palette + content search exist; triage of inbox could be a one-keystroke flow | Partial — polish, not new feature |
| TickTick | Habits + pomodoro + calendar in one | All present; integration depth is the differentiator | Covered |
| Sunsama | Guided daily planning ritual | The morning/evening digest is the local-first equivalent | Covered |
| Motion | Auto-scheduling | **Rejected**: needs sync/backend; violates local-first constraint | No |
| Notion | Linked docs ↔ tasks | Notes already link to tasks (`linkedTaskId`) | Covered |

Net: the highest-value gaps are **not missing features** — they are measurement
(bundle budget, CWV, axe in CI) and micro-polish of the capture→triage loop. Adding
features would contradict the product's local-first, no-backend thesis.

## 3. Prioritized roadmap

- **P1 (done this pass):** stop precaching legacy `.woff` in the SW (~135 kB dead cache).
- **P2:** add CI gates — Lighthouse (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1) on the built
  app, axe-core a11y scan, and a bundle-size budget on the index chunk. Cheap, prevents
  regressions; no product risk.
- **P3:** profile the tasks/notes lists with React Profiler at ~500 records; only then
  add memo/virtualization if a real hotspot appears (no evidence yet — do not add
  speculatively).
- **P4:** one-keystroke inbox triage on /tasks (keyboard-driven, mirroring the existing
  ⌘K capture pattern) if user friction is confirmed.
- **Explicitly rejected:** multi-device sync, AI features, push notifications — all
  require a server and contradict the documented local-first decision.

## 4. Implemented changes

- `vite.config.ts` + `scripts/postbuild-sw.mjs`: precache glob changed from
  `**/*.{js,css,woff,woff2,...}` to `**/*.{js,css,woff2,...}` with a comment citing the
  DOWNFORCE lesson. Legacy woff files remain deployed and served; they are just no
  longer dead weight in the offline cache.

## 5. Verification

- `tsc --noEmit`: clean.
- `vitest run`: 24 files, 286 tests, all pass (includes `pwa-icons.test.ts`, which pins
  the build chain).
- Full production build + `postbuild-sw.mjs`: succeeds; generated `sw.js` contains
  **0** `.woff` precache entries (was 3 files / ~135 kB) and still precaches
  `_shell.html`, all `assets/*`, fonts woff2, manifest, favicon; self-check needles pass.

## 6. Not verified / known limits

- No runtime Lighthouse/axe measurements were possible in this environment (no browser
  automation available); CWV numbers are targets to gate in CI, not measured claims.
- Subagent-based deep recon (per-page UX audit, perf profiling, web-grounded competitive
  research) was attempted but blocked by provider credit limits; the competitive table
  above is principle-level from product knowledge, cross-checked against the repo's own
  feature list — treat it as a starting map, not measured evidence.
