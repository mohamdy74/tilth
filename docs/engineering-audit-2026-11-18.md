# Tilth — Engineering Audit & Cleanup Report (2026-11-18)

Baseline commit: `5de623f` (`main`). Implementation plan: `docs/superpowers/plans/2026-11-18-engineering-audit-cleanup.md`.

## A. Baseline

Fresh commands were run before editing; previous reports were not treated as current evidence.

| Check                     | Original result                                                       |
| ------------------------- | --------------------------------------------------------------------- |
| `npm run typecheck`       | PASS                                                                  |
| `npm test`                | PASS — 37 files, 415 tests                                            |
| `npm run lint`            | FAIL — 103 CRLF/Prettier errors, 8 warnings                           |
| `npm run build`           | PASS, including final SW regeneration                                 |
| `npm ls --depth=0`        | FAIL — installed Lovable config 2.26.5 disagreed with manifest 2.27.1 |
| Baseline client CSS       | 128.58 kB raw / 29.86 kB gzip                                         |
| Baseline main JS          | 378.99 kB raw / 120.39 kB gzip                                        |
| Baseline lazy insights JS | 410.80 kB raw / 108.81 kB gzip                                        |

Architecture verified from source: React 19, TanStack Router/Start SPA with route splitting, zustand over per-key IndexedDB envelopes, pure domain engines, BroadcastChannel merging, encrypted sync transport, Arabic-first i18n/RTL, Tailwind tokens, and a postbuild-regenerated service worker. No schemas, migrations, storage formats, generated route files, or storage/sync APIs were changed.

## B. Findings and dispositions

### High — unused template system and dependency surface (addressed)

The app reached only `button`, `sheet`, and `sonner` under `src/components/ui`. The other 43 UI modules formed an unreachable template cluster; `use-mobile.tsx` was referenced only by that cluster. Tailwind nevertheless scanned these files, so they inflated the production CSS artifact. Their packages also remained direct dependencies despite no live imports.

### Medium — dead declarations and selectors (addressed)

TypeScript with `noUnusedLocals` and `noUnusedParameters` identified 15 unused imports/parameters across live routes, the store, and two tests. Seven store selector exports had no callers anywhere in the private app. Removing the selectors also orphaned their `live` helper. These were compatibility-free deletions, not an engine rewrite.

### Medium — lint was not a useful CI gate (addressed)

Three files had CRLF-only Prettier failures, and CI explicitly used `continue-on-error`. The focus keyboard effect also had an exhaustive-deps warning. Formatting was normalized without program-text changes, the focus handlers were given stable dependencies, and CI lint is now blocking.

### Low — dependency installation inconsistency (addressed)

`bun remove`/`bun install` synchronized the install with the already-declared Lovable config 2.27.1. Final `npm ls --depth=0` exits successfully with no invalid package.

### Not changed

- No meaningful duplicate business logic justified a new generic abstraction. The existing pure engines remain the canonical implementations.
- Tasks/habits/focus timing, rewards, achievements, shop, migrations, backup/export, multi-tab merge, sync, and date handling were left intact.
- Existing route splitting, lazy insights/recharts, timestamp-based focus timer, storage batching, and final-SW self-check were retained.
- No memoization, virtualization, caching, lazy-loading, or dependency replacement was added without runtime evidence.
- No large route/i18n file was mechanically split; file size alone is not evidence of a better module boundary.

## C. Changes

1. **Removed the unreachable UI cluster.**
   - Deleted 43 unused `src/components/ui` modules and orphaned `src/hooks/use-mobile.tsx`.
   - Retained the three imported UI modules and their class definitions.
   - Replaced `button.tsx` with `button.ts`, retaining `buttonVariants` and the three canonical class constants while removing the unused React `Button`/`ButtonProps` path and Radix Slot dependency.
   - Risk checked: hidden imports, route discovery, dynamic imports, generated route references, and reachable class generation. No generated files were edited.

2. **Removed 36 direct dependency declarations: 35 production and 1 development.**
   - Production direct dependencies: 57 → 22; development: 25 → 24.
   - Removed packages exclusively used by deleted components, plus unused `@hookform/resolvers`, `date-fns`, `zod`, and `@testing-library/react`.
   - Kept Radix Dialog, cva/clsx/tailwind-merge, test setup packages, and both vite-plugin-pwa Workbox peers.

3. **Removed dead live-code declarations.**
   - Cleaned the compiler-confirmed imports/parameters without changing any assertion or fixture.
   - Removed seven unused store selectors and their helper; all store actions and reward wiring remain unchanged.
   - Enabled `noUnusedLocals` and `noUnusedParameters` permanently in `tsconfig.json` to prevent regression.

4. **Corrected focus effect dependencies without changing shortcut logic.**
   - `startWork` and `togglePause` now use stable callbacks with their actual inputs; the keyboard effect depends on those callbacks.
   - Space/Escape filtering and timer logic were not rewritten. The exhaustive-deps warning is gone.
   - Browser smoke verified Focus start, pause, cancellation modal, and incomplete-session handling. Synthetic Space/Escape delivery through the browser panel was inconclusive and is not claimed as keyboard verification.

5. **Restored quality gates.**
   - Normalized only `eslint.config.js`, `vitest.config.ts`, and `scripts/decode-icons.mjs`; `git diff --ignore-space-at-eol` showed no program-text change.
   - Removed `continue-on-error` from the CI Lint step.

## D. Measurable results

| Metric                   |                  Before |                    After |                                Change |
| ------------------------ | ----------------------: | -----------------------: | ------------------------------------: |
| Client CSS               |               128.58 kB |                 87.51 kB |                **−41.07 kB (−31.9%)** |
| Client CSS gzip          |                29.86 kB |                 23.97 kB |                 **−5.89 kB (−19.7%)** |
| Shared `button` JS chunk |               134.21 kB |                130.89 kB |                              −3.32 kB |
| Shared `button` JS gzip  |                44.63 kB |                 43.44 kB |                              −1.19 kB |
| Main JS                  |               378.99 kB |                379.00 kB | +0.01 kB; gzip unchanged at 120.39 kB |
| Lazy insights JS         |               410.80 kB |                410.80 kB |             Unchanged; gzip 108.81 kB |
| Tests                    |   37 files / 415 passed |    37 files / 415 passed |          No tests removed or weakened |
| Lint                     | 103 errors / 8 warnings | **0 errors / 1 warning** |                  CI now blocks errors |

Final verification evidence:

- `bun install`: 721 installs checked across 792 packages, no changes.
- `npm ls --depth=0`: exit 0; Lovable config aligned at 2.27.1.
- `npm run typecheck`: exit 0 with both unused-check flags enabled.
- `npm run lint`: exit 0; one pre-existing preferences fast-refresh warning remains.
- `npm test`: 37 files and 415 tests passed.
- `npm run build`: exit 0; `postbuild-sw.mjs` regenerated and checked the final worker.
- Real workerd smoke: `/`, `/settings`, `/sw.js`, `/manifest.webmanifest`, and `/_shell.html` each returned HTTP 200.
- Browser smoke: Arabic dashboard rendered with the expected computed primary-button styling; Focus start/pause/cancel worked without a page error.

Build-time differences were not reported as improvements: cache warmth changed between runs. No claim of faster React rendering, lower INP, or reduced runtime memory is made.

## E. Remaining technical debt

- **Runtime measurement gap (medium):** the main and lazy-insights chunks remain substantial, but no comparable CWV/React profile establishes a user-facing problem. Profile before optimizing; consider a bundle budget/CWV gate as a separately approved measurement task.
- **List/render hotspots are unproven (medium):** large task/habit lists contain repeated derivations. No memoization or virtualization was added without profiling at realistic record counts.
- **Lovable-owned build plugin warning (low):** Vite recommends native tsconfig path resolution, but the plugin is supplied by the Lovable base config. It was not manually ripped out; any migration belongs in that managed config with comparable clean-build timing.
- **PWA stage warnings (low):** intermediate plugin passes still warn about an incomplete `dist` glob. The intentional postbuild regeneration and self-check cover the final output, and workerd probes pass. Removing the warning is not worth risking offline behavior.
- **Preferences fast-refresh warning (low):** splitting provider and hook solely to silence a development-only warning would add a module without improving production behavior.
- **Coverage limit:** this was not an exhaustive manual interaction sweep across every route, locale, viewport, and data state. Existing engine tests, route/build checks, workerd probes, and targeted Arabic browser smoke bound the regression risk but do not prove every user flow.

## F. Final assessment

The app is genuinely simpler to maintain: an unreachable component/dependency subsystem is gone, dead exports and declarations are removed, unused-code checks now run by default, and lint can protect future changes in CI. It is more efficient in a measured but bounded way: production CSS is 31.9% smaller raw and 19.7% smaller gzip, with a small shared-JS reduction. The underlying product architecture and data behavior were deliberately preserved; no runtime speedup is claimed without measurement.
