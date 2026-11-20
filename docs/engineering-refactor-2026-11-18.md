# Tilth — Sync & Task-View Refactor Report (2026-11-18)

Second engineering pass, based on merged `main` at `b50b982`. Plan: `docs/superpowers/plans/2026-11-18-sync-task-view-refactor.md`.

## A. Baseline

Fresh verification before editing:

- `npm run typecheck`: PASS with unused checks enabled.
- `npm run lint`: exit 0; one existing preferences fast-refresh warning.
- `npm test`: 37 files / 415 tests passed.
- `npm run build`: PASS; final service-worker regeneration succeeded.
- CSS: 87.54 kB raw / 23.97 kB gzip.
- Main JS: 379.00 kB / 120.39 kB gzip; lazy insights: 410.80 kB / 108.81 kB gzip.
- `HEAD` and `origin/main` were synchronized; only pre-existing untracked `.openchamber/` and `bun.lock` were present.

The previous dead-code/dependency cleanup was not repeated. This pass targeted two remaining issues: measurable sync serialization and business logic embedded in the Tasks route.

## B. Findings

### High — unnecessary canonical serialization in `mergeSync` (addressed)

`src/lib/sync.ts` computed `stableStringify` for both records before checking deletion status or timestamps. Different timestamps already select the newer record; deletion mismatches already select the sticky tombstone. Canonical JSON is needed only for identical-content and deterministic same-timestamp tie-breaking.

Root cause: branch ordering performed the most expensive common operation before the cheap decisions. The cost was measured, not inferred from complexity alone.

### Medium — task-view domain logic embedded in the route (addressed)

`src/routes/tasks.tsx` contained the complete search/priority/tag filter, five-bucket derivation, and per-bucket sorting inline. The route also redeclared the existing `TaskBucket` union as `ViewKey`.

This made domain behavior harder to unit-test independently and added a second name for an existing type. Extracting this specific cohesive derivation is justified; mechanically splitting the rest of the large route is not.

### Rejected / left alone

- No memoization, virtualization, caching, lazy-loading, or new dependencies.
- No sync transport, storage, schema, reward, timer, or migration rewrites.
- No generic utility for unrelated repeated lines and no mechanical split of Settings/Habits/AppShell.
- No claim of faster React rendering or better INP from the Node sync benchmark.

## C. Changes

### 1. Sync merge branch ordering

Files: `src/lib/sync.ts`, `src/lib/sync.test.ts`.

The merge now handles deletion mismatches and different timestamps before computing canonical JSON. Same-timestamp records still use the original identical-content check and lexicographic deterministic conflict resolution. Conflict metadata and output ordering are unchanged.

Added a test for same-timestamp delete-vs-edit; the existing tests continue to cover one-sided records, newer-wins, identical content, deterministic ties, and different-timestamp deletion.

Risk: sync conflict semantics are data-integrity sensitive. The new branch test passed before and after the refactor, and the benchmark produced exactly 3,000 merged records and 300 conflicts in every run.

### 2. Pure task-view derivation

Files: new `src/lib/taskViews.ts`, new `src/lib/taskViews.test.ts`, modified `src/routes/tasks.tsx`.

`buildTaskViews(liveTasks, options)` now owns the exact filter/bucket/sort derivation and delegates ordering to the existing `sortTasks`. The route passes `deferredSearch` and uses the existing `TaskBucket` type instead of duplicating it as `ViewKey`.

Five new tests pin:

- Stored-day buckets and completed-task precedence.
- Priority, exact tag, and trimmed case-insensitive text filters.
- Selected ordering for active buckets.
- Newest-first completed ordering for `due`, and selected ordering otherwise.
- Input-array immutability.

The test suite failed on the missing module before implementation and passed afterward. No store action, saved-view shape, kanban behavior, or UI copy changed.

## D. Measurable results

### Sync benchmark

Identical deterministic input: 3,000 paired records with nested values, 30 merge iterations per measurement.

| Condition             |       Mean time per merge |
| --------------------- | ------------------------: |
| Baseline, idle runs   |        34.05 ms, 33.44 ms |
| Refactored, idle runs | 8.98 ms, 9.04 ms, 9.11 ms |
| Median comparison     |       **33.75 → 9.04 ms** |

Result: **73.2% less elapsed time**, approximately **3.7× throughput** for this input. An earlier baseline run during a concurrent production build (41.86 ms) was excluded from the idle comparison rather than used to inflate the result. This is a pure Node engine benchmark, not a measured UI responsiveness claim.

### Verification and artifacts

- `npm run typecheck`: PASS.
- `npm run lint`: exit 0; one existing preferences warning.
- `npm test`: **38 files / 421 tests passed** (six new tests; none removed or weakened).
- `npm run build`: PASS; final SW self-check succeeded.
- Workerd: `/`, `/settings`, `/tasks`, `/sw.js`, `/manifest.webmanifest`, and `/_shell.html` all returned HTTP 200.
- Browser smoke: Tasks rendered in Arabic and English; bucket navigation updated correctly. The browser tool did not reliably enter text into controlled inputs, so search/filter evidence comes from the pure tests, not a claimed data-entry E2E pass.
- Tasks route chunk: 26.76 → 26.87 kB raw (+0.11); 7.28 → 7.31 kB gzip (+0.03). This small module-linking increase is reported, not presented as a bundle optimization.
- CSS, main JS, and lazy-insights sizes were unchanged.

## E. Remaining technical debt

- **UI render performance remains unprofiled:** the sync improvement does not establish faster screens. Realistic-record React profiling is still required before list memoization or virtualization.
- **E2E input coverage is limited:** controlled text input and global synthetic keyboard events need a more reliable browser automation path before being used as regression evidence.
- **Preferences fast-refresh warning:** retained because splitting the provider solely for a development-only warning adds no production value.
- **Managed build/PWA warnings:** the Lovable tsconfig-path recommendation and intentional intermediate PWA glob warnings remain; the final postbuild self-check and workerd probes cover the output.
- **Large UI modules:** Tasks was reduced only where a cohesive domain boundary existed. No low-value mechanical splitting was performed elsewhere.

## F. Final assessment

This increment improves both measured efficiency and maintainability. Sync merges avoid substantial unnecessary serialization while preserving conflict behavior, and task-view logic now has a single typed, pure, tested home instead of being embedded in the route. The changes are deliberately narrow: no architecture rewrite, new infrastructure, data-shape change, or unmeasured rendering claim.
