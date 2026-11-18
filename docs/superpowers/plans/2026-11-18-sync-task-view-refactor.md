# Sync and Task-View Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Reduce measured sync-merge cost and move task-view business logic out of the route into a pure, tested domain module without changing behavior.

**Architecture:** Keep the existing sync engine and task sorting APIs. Reorder `mergeSync` branches so canonical JSON is computed only for same-timestamp, same-deletion-status records. Extract the existing task filtering/bucketing/sorting code verbatim into `buildTaskViews` and reuse the existing `TaskBucket` type.

**Tech Stack:** TypeScript, React, Vitest, TanStack Router, zustand, Vite/workerd.

**Spec:** User-supplied “Tilth — Engineering Audit, Codebase Cleanup & Structural Refactoring” mission (second pass, 2026-11-18).

## Global Constraints

- Preserve tombstone/sticky-delete semantics, deterministic same-timestamp conflicts, stored LocalDay bucketing, search/filter/sort behavior, schemas, and all store actions.
- No new dependencies, memoization, caching, route redesign, or generated-file edits.
- Use the existing `sortTasks`, `Task`, `TaskBucket`, `TaskSort`, and `SyncRecord` interfaces.
- Baseline at `b50b982`: typecheck PASS; lint PASS with one preferences warning; 37 files/415 tests PASS; production build PASS. CSS 87.54 kB/23.97 kB gzip; main JS 379.00 kB/120.39 kB gzip; insights 410.80 kB/108.81 kB gzip.
- Baseline sync benchmark (3,000 paired records, 30 iterations): 41.86, 34.05, and 33.44 ms mean per merge; median 34.05 ms.

## Review Focus

- Delete-vs-edit must win regardless of timestamp; cover both same and different timestamps.
- Canonical tie-breaking is still required for same-timestamp different content and must remain argument-order independent.
- Completed tasks always enter `completed`, even when undated/overdue; `due` sort uses newest `completedAt` first.
- Search remains trimmed and case-insensitive for title/notes; tag matching keeps its existing semantics.
- The route must continue using `deferredSearch`; no new memoization is introduced by this refactor.

---

### Task 1: Avoid unnecessary canonical JSON in sync merges

**Files:**
- Modify: `src/lib/sync.ts:92-138`.
- Test: `src/lib/sync.test.ts`.

**Interfaces:**
- Consumes: `mergeSync(local, remote, at)` and `stableStringify`.
- Produces: identical `MergeResult` values and conflict metadata.

- [x] **Step 1: Add the missing same-timestamp deletion branch test**
Add a test where one record is deleted and the other is live with the same `updatedAt`; assert the tombstone and `delete-vs-edit` conflict win. Run `npx vitest run src/lib/sync.test.ts`; expect all existing and new tests to pass before refactoring.

- [x] **Step 2: Reorder the existing branches**
Handle one-sided records, then deletion mismatch, then different timestamps. Only when timestamps and deletion status match, compute `ls`/`rs`, return identical records, or apply the existing canonical tie-break. Keep the conflict object shape and output ordering unchanged.

- [x] **Step 3: Verify behavior and measure**
Run `npx vitest run src/lib/sync.test.ts`, `npm run typecheck`, and the same temporary benchmark three times. Require identical 3,000 merged records and 300 conflicts; record median/range without claiming a UI responsiveness improvement.

### Task 2: Extract the task-view derivation

**Files:**
- Create: `src/lib/taskViews.ts`.
- Test: `src/lib/taskViews.test.ts`.
- Modify: `src/routes/tasks.tsx:31-34,54-57,167-206`.

**Interfaces:**
- Consumes: live `Task[]`, `today`, `priority`, `tag`, `search`, and `sort`; existing `sortTasks`.
- Produces: `buildTaskViews(tasks, options): Record<TaskBucket, Task[]>` with the exact current filtering, bucketing, and sorting behavior.

- [x] **Step 1: Write failing pure tests**
Pin all five buckets, completed-overdue precedence, priority/tag/search filters, completed ordering, and input immutability. Run `npx vitest run src/lib/taskViews.test.ts`; expect failure because `taskViews.ts` does not exist.

- [x] **Step 2: Implement `buildTaskViews`**
Move the existing filter predicate, bucket loop, and sort decisions into the pure module. Do not change the search semantics or introduce a second task type union.

- [x] **Step 3: Use it from the route**
Replace `ViewKey` with `TaskBucket`, pass `deferredSearch` to `buildTaskViews`, and delete the inline derivation. Keep `live`, `allTags`, `visible`, saved views, and kanban logic in their current form.

- [x] **Step 4: Verify the increment**
Run `npx vitest run src/lib/taskViews.test.ts src/lib/taskSort.test.ts src/test/app-routing.test.tsx`, `npm run typecheck`, and `npm run lint`. Smoke-render `/tasks` in Arabic and English; verify bucket counts, search, and one filter.

### Task 3: Final verification and report

**Files:**
- Create: `docs/engineering-refactor-2026-11-18.md`.

- [x] **Step 1: Review the final diff**
Require only the scoped files plus the plan/report; no generated files, dependencies, schemas, or unrelated UI changes.

- [x] **Step 2: Run the complete gates**
Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Expect 38 test files and at least 416 tests (the exact added count is recorded after implementation). Probe `/`, `/settings`, `/tasks`, `/sw.js`, `/manifest.webmanifest`, and `/_shell.html` under workerd; require 200.

- [x] **Step 3: Document results**
Record the before/after sync benchmark under comparable idle conditions, exact test/build results, behavior preserved, rejected speculative changes, and remaining measurement debt. Do not claim a bundle or rendering improvement without an observed artifact/profile change.
