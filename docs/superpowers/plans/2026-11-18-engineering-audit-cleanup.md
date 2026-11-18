# Engineering Audit Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Remove verified dead code and dependency weight, restore useful static checks, and preserve all product behavior and data compatibility.

**Architecture:** Keep the current React/TanStack/zustand/IndexedDB/PWA architecture. Make three isolated increments: unreachable UI/dependency cleanup, compiler-confirmed dead-code cleanup with a lint-only focus-handler correction, then formatting/CI hygiene. Validate each increment independently and run the complete suite at the end.

**Tech Stack:** React 19, TypeScript, TanStack Start/Router, Tailwind v4, zustand, idb-keyval, Vitest, ESLint, Vite, vite-plugin-pwa, workerd.

**Spec:** User-supplied “Tilth — Engineering Audit, Codebase Cleanup & Structural Refactoring” mission (2026-11-18).

## Global Constraints

- Preserve offline-first behavior, schemas/migrations, import/export, multi-tab merging, focus timing, rewards, localization/RTL, accessibility, responsive behavior, and PWA behavior.
- No new dependencies, product features, backend/infrastructure, UI redesign, or speculative memoization/caching/lazy loading.
- Do not edit generated files, including `src/routeTree.gen.ts`.
- Leave pre-existing untracked `.openchamber/` and `bun.lock` ownership unchanged; do not commit unless requested.
- Separate baseline failures from regressions. Baseline: typecheck PASS; 37 files/415 tests PASS; lint FAIL (103 CRLF errors + 8 warnings); production build PASS. `npm ls --depth=0` also reports the installed Lovable config 2.26.5 against manifest 2.27.1.

## Review Focus

- Runtime references can hide behind route discovery or dynamic imports: only `button.ts`, `sheet.tsx`, and `sonner.tsx` are reachable from application imports; the route tree remains untouched. Verify with import searches plus typecheck/build.
- Removing unused UI files changes Tailwind’s scanned class set: compare the production CSS artifact, and smoke-render the app to ensure reachable components retain their classes.
- Dependency removal must retain Radix dialog, cva/clsx/tailwind-merge, PWA peer dependencies, and test setup packages. Verify a Bun install and clean typecheck/test/build.
- Focus keyboard behavior must remain identical while satisfying exhaustive-deps: Space starts/pauses, Escape cancels, fields/interactive controls remain excluded. Use stable callbacks rather than re-registering on every 500 ms tick.
- The service worker warnings during intermediate Vite stages are already covered by `postbuild-sw.mjs`; retain that pipeline and probe the final worker and shell under workerd.

---

### Task 1: Remove the unreachable UI template cluster and unused packages

**Files:**
- Delete: every `src/components/ui/*.tsx` except `button.ts`, `sheet.tsx`, and `sonner.tsx`.
- Delete: `src/hooks/use-mobile.tsx` (only referenced by deleted `sidebar.tsx`).
- Modify: `src/components/ui/button.ts` (remove the unused `Button`/`ButtonProps` React component and Slot import; retain `buttonVariants`, `PRIMARY_BTN`, `OUTLINE_BTN`, and `DANGER_BTN`).
- Modify: `package.json` and the local Bun lock/install state.

**Interfaces:**
- Consumes: existing app imports of `buttonVariants` and the three button class constants; `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`; `Toaster`.
- Produces: the same reachable exports and rendered class names. No schema or runtime API changes.

- [x] **Step 1: Re-verify the deletion set**
Run import searches for every UI module and `useIsMobile`; only the three retained modules may be reachable from `src/components/app`, `src/routes`, or other live entry points. Print the exact files selected for deletion before removing them.

- [x] **Step 2: Delete unreachable modules and trim `button.ts`**
Do not rewrite the cva variant definitions or any retained class string. Remove only the unused React component path and its now-unused imports/types.

- [x] **Step 3: Remove only packages exclusively used by deleted code**
Remove the unused Radix packages (retain `react-dialog`; remove `react-slot` after the button trim), `@hookform/resolvers`, `cmdk`, `date-fns`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-hook-form`, `react-resizable-panels`, `vaul`, `zod`, and unused `@testing-library/react`. Retain `workbox-build` and `workbox-window`, which are declared vite-plugin-pwa peers.

- [x] **Step 4: Verify the increment**
Run `bun install`, `npm run typecheck`, and `npm run build`. Expect zero type errors and a successful build. Record raw/gzip CSS and JS output; do not claim a JS runtime improvement unless the measured comparable artifact changes.

### Task 2: Remove compiler-confirmed dead code and stabilize focus keyboard dependencies

**Files:**
- Modify: `src/lib/store.ts` (seven unreferenced selectors and unused type/reward imports).
- Modify: `src/routes/focus.tsx`, `src/routes/habits.tsx`, `src/routes/index.tsx`, `src/routes/settings.tsx`, `src/routes/tasks.tsx`.
- Modify: `src/lib/exportZip.test.ts`, `src/lib/pwa-icons.test.ts` (unused declarations only; no assertions changed).

**Interfaces:**
- Consumes: existing store actions and focus handlers.
- Produces: no exported selector removal affects a live caller; `startWork` and `togglePause` retain their behavior with stable React callbacks.

- [x] **Step 1: Capture the compiler inventory**
Run `node node_modules/typescript/bin/tsc --noEmit --noUnusedLocals --noUnusedParameters`; retain the baseline list and remove only reported dead declarations plus the separately grep-verified selector block.

- [x] **Step 2: Apply surgical cleanup**
Remove unused imports, the unused test encoder and loop key, and all seven selector exports. Do not alter tests, fixtures, records, or store actions.

- [x] **Step 3: Correct the focus effect dependency warning**
Wrap `startWork` in `useCallback` with `[mode, customWork, linkedTaskId]`; wrap `togglePause` with `[active]`; depend on those callbacks in the keyboard effect instead of duplicating their dependencies. This is for listener/effect correctness, not a claimed render optimization.

- [x] **Step 4: Verify the increment**
Run the unused-aware TypeScript command, `npm run typecheck`, `npm run lint`, and `npx vitest run src/lib/focusTime.test.ts src/test/app-routing.test.tsx`. Expect no compiler-unused findings and no focus exhaustive-deps warning. ESLint may retain the pre-existing preferences fast-refresh warning but must exit zero after Task 3’s CRLF correction.

### Task 3: Restore a trustworthy lint gate

**Files:**
- Modify line endings only: `eslint.config.js`, `vitest.config.ts`, `scripts/decode-icons.mjs`.
- Modify: `.github/workflows/ci.yml`.
- Modify: `tsconfig.json` (enable the now-clean unused-local and unused-parameter checks permanently).

**Interfaces:**
- Consumes: existing Prettier/ESLint configuration and CI quality job.
- Produces: lint that exits successfully on the cleaned baseline and fails CI on future lint errors.

- [x] **Step 1: Normalize only the three CRLF offenders**
Run Prettier on exactly those files and confirm with `git diff --ignore-space-at-eol` that no program text changed.

- [x] **Step 2: Make CI lint blocking**
Remove `continue-on-error: true` and its obsolete TODO from the existing Lint step; do not otherwise alter CI.

- [x] **Step 3: Verify the increment**
Run `npm run lint`; require exit 0. A warning without a nonzero exit is recorded, not hidden or mass-suppressed.

### Task 4: Full verification and evidence report

**Files:**
- Create: `docs/engineering-audit-2026-11-18.md`.

- [x] **Step 1: Review the complete diff**
Confirm the deletion set, package changes, and every remaining edit match this plan; ensure `.openchamber/` remains untouched and no generated file was edited.

- [x] **Step 2: Run the complete repository checks**
Run `bun install`, unused-aware TypeScript, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Require the same 37 test files/415 tests, zero type errors, lint exit 0, and a successful production build.

- [x] **Step 3: Probe the real production runtime**
Serve `.output` with Wrangler/workerd and require HTTP 200 for `/`, `/settings`, `/sw.js`, `/manifest.webmanifest`, and `/_shell.html`. Inspect the final service-worker self-check output.

- [x] **Step 4: Record measured results and remaining debt**
Compare bundle artifacts against baseline CSS 128.58 kB raw / 29.86 kB gzip, main index 378.99 kB / 120.39 kB gzip, lazy insights 410.80 kB / 108.81 kB gzip. Document dependency removals and install state without presenting file/line counts as the primary success metric. Leave unmeasured React list/render optimizations, the intentional PWA postbuild workaround, Lovable-owned tsconfig-path plugin warning, and any unproven architectural rewrites as documented remaining debt.
