# Deliverable 8 — Performance and UX Standards

Measurable acceptance criteria. **Baseline is measured from the actual
codebase and CI, not invented.** Numerical targets are improvements over the
baseline, proposed only where the research shows user-facing impact.

---

## Measured baseline (current main)

| Metric                     | Value                                    | Source               |
| -------------------------- | ---------------------------------------- | -------------------- |
| Test suite                 | 421 passed / 38 files, 0 failures        | `npx vitest run`     |
| Test duration              | 96.54s                                   | `npx vitest run`     |
| Typecheck (`tsc --noEmit`) | 0 errors                                 | `npx tsc --noEmit`   |
| Lint (`eslint .`)          | 0 errors, 1 warning                      | `npx eslint .`       |
| workerd SSR smoke          | gate requires 200 on `/` and `/settings` | CI (not re-run here) |

Runtime (browser) metrics were not instrumented in the current build, so the
numeric interaction targets below are **proposed acceptance criteria** to be
verified against real measurement before being treated as passed. Where the
codebase already guarantees a property (e.g., timer correctness from
timestamps), that is noted as existing behavior, not a target.

---

## Acceptance criteria

### Startup responsiveness

- **Cold open to interactive:** PWA shell + fonts precached; skeleton shown
  until `ready`; no content flash. (Existing: bootStore post-hydration,
  skeletons on every route.)
- **Target:** first paint < 1s on cached repeat visit; < 3s cold on 4G.
- **Verify:** Lighthouse / Chrome DevTools performance on the published build.

### Task creation (capture)

- **From decision to saved:** < 3 seconds.
- Quick-add bar on /tasks accepts `title !priority #tag dateword` inline;
  `parseQuickAdd` is pure and synchronous. (Existing: B3/B4.)
- **Target:** quick-add submit stores to IndexedDB and clears input in one
  frame; no loading state. (Things 3 benchmark: <1s quick entry — B2.)

### Task completion

- **Toggle latency:** immediate optimistic UI; undo toast offered.
- Idempotent complete/reopen via `tasks.complete`/`tasks.reopen`; XP awarded
  through single `applyRewardEvent` wiring. (Existing: B4/B9.)
- **Target:** completion reflects in counts/rings on the same frame; undo
  available for ≥ 5 seconds.

### Navigation

- Route change via TanStack Router; skeletons until `ready` on each page.
- **Target:** navigation between existing pages feels instant (cached shell);
  no full reload on tab switch.

### Search

- Task search uses `useDeferredValue` (existing: tasks.tsx) — deferred to
  avoid blocking input.
- **Target:** search input never blocks typing; results update within ~150ms
  of input settle.

### Animations

- Progress ring: `stroke-dashoffset` transition 700ms `var(--ease-out)`
  (existing: index.tsx).
- Timer ring: `stroke-dashoffset` 500ms linear (existing: focus.tsx).
- **Target:** 60fps; `prefers-reduced-motion` respected; no layout thrash on
  tick (focus timer re-renders only via 500ms tick, time from timestamps).

### Offline interactions

- PWA service worker precaches shell, fonts, assets; `shouldRegisterPwa`
  skips dev/localhost/lovable.dev (existing: B18).
- IndexedDB writes are local-first; debounced 250ms, flushed on tab hide.
- **Target:** full task/habit/focus/note CRUD works offline; changes sync
  on reconnect (multi-tab BroadcastChannel).

### Synchronization (optional encrypted remote)

- Local is source of truth; pull merges remote on top, never overwrites newer
  local data; conflicts presented to user. (Existing: B17.)
- **Target:** sync never silently loses data; passphrase never leaves device.

### Mobile usability

- PWA installable; manifest `dir=rtl`, `lang=ar`; standalone display.
- Touch targets ≥ 44px; logical properties (ps/pe, start/end) for RTL.
- **Target:** install prompt shows; offline works on installed PWA.

### Accessibility

- Dialogs trap focus and return focus to opener (architecture contract).
- Timer has `role="timer"`, `aria-live="off"`; charts `role="img"` with
  aria-label from summary line (existing: focus.tsx, insights.tsx).
- Arabic line-height/letter-spacing under `[dir="rtl"]` (architecture contract).

---

## Verification method

Before marking any target "met," instrument real measurement (DevTools
Performance / Lighthouse / web-vitals) on the published build and record:

- FCP, LCP, TTI for cold and cached visits.
- Quick-add submit→store latency.
- 60fps animation frames during timer/progress.

Update this document with observed numbers, then re-propose targets if the
baseline differs from these proposals.
