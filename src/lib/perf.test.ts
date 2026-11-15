import { describe, expect, it } from "vitest";
import { buildWeek, monthWeeks } from "./weekView";
import { morningDigest, eveningDigest } from "./digest";
import { parseQuickAdd } from "./quickAdd";
import type { FocusSession, Habit, HabitLog, Task } from "./types";

/*
 * Performance regression guards for the pure engines that sit on interaction
 * paths (calendar re-render, dashboard digest, quick capture, command search).
 * Budgets are deliberately generous so modest CI hardware doesn't flake, but
 * they catch accidental O(n²) work — the class of regression that made the
 * month grid unshippable before monthWeeks(). Times are printed for the record.
 */

const DAY = "2026-11-20";
const stamp = "2026-11-20T09:00:00.000Z";

const mkTask = (i: number): Task => ({
  id: "t" + i,
  title: "Task number " + i,
  priority: (["high", "medium", "low"] as const)[i % 3]!,
  tags: ["tag" + (i % 12)],
  subtasks: [],
  status: i % 4 === 0 ? "done" : "todo",
  kanbanOrder: i,
  dueDate: `2026-11-${String((i % 28) + 1).padStart(2, "0")}`,
  ...(i % 4 === 0 ? { completedAt: stamp } : {}),
  createdAt: stamp,
  updatedAt: stamp,
});
const mkHabit = (i: number): Habit => ({
  id: "h" + i,
  name: "Habit " + i,
  schedule: { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
  archived: false,
  createdAt: stamp,
  updatedAt: stamp,
});
const mkLog = (i: number): HabitLog => ({
  id: "l" + i,
  habitId: "h" + (i % 200),
  localDay: DAY,
  status: "done",
  createdAt: stamp,
  updatedAt: stamp,
});
const mkSession = (i: number): FocusSession => ({
  id: "s" + i,
  mode: "pomodoro",
  startedAt: stamp,
  endsAt: stamp,
  endedAt: stamp,
  completed: true,
  distractions: [],
  plannedMinutes: 25,
  localDay: DAY,
  createdAt: stamp,
  updatedAt: stamp,
});

type Row = { label: string; ms: number; budget: number };
const rows: Row[] = [];
const measure = (label: string, budget: number, fn: () => unknown) => {
  const t0 = performance.now();
  fn();
  const ms = performance.now() - t0;
  rows.push({ label, ms: Math.round(ms * 100) / 100, budget });
  return ms;
};

describe("engine performance guards", () => {
  const TASKS = 3000;
  const HABITS = 200;
  const LOGS = 2000;
  const SESSIONS = 500;

  it("buildWeek stays linear with 3k tasks + 2k logs", () => {
    const tasks = Array.from({ length: TASKS }, (_, i) => mkTask(i));
    const habits = Array.from({ length: HABITS }, (_, i) => mkHabit(i));
    const logs = Array.from({ length: LOGS }, (_, i) => mkLog(i));
    const sessions = Array.from({ length: SESSIONS }, (_, i) => mkSession(i));
    const ms = measure("buildWeek(3k tasks, 2k logs)", 150, () =>
      buildWeek({ tasks, habits, logs, sessions, anchor: DAY, today: DAY, weekStartsOn: 6 }),
    );
    expect(ms).toBeLessThan(150);
  });

  it("monthWeeks is constant-time (one call, 7-day rows)", () => {
    const ms = measure("monthWeeks", 5, () => monthWeeks(DAY, 6));
    expect(ms).toBeLessThan(5);
  });

  it("digest over 3k tasks stays under 100ms", () => {
    const tasks = Array.from({ length: TASKS }, (_, i) => mkTask(i));
    const base = {
      tasks,
      habits: [],
      logs: [],
      sessions: [],
      today: DAY,
      dayStartHour: 0,
      timeZone: "UTC",
    };
    const ms = measure("morningDigest(3k tasks)", 100, () => morningDigest({ ...base, hour: 8 }));
    measure("eveningDigest(3k tasks, cold)", 100, () => eveningDigest({ ...base, hour: 20 }));
    measure("eveningDigest(3k tasks, warm)", 100, () => eveningDigest({ ...base, hour: 20 }));
    expect(ms).toBeLessThan(100);
  });

  it("quickAdd parses 2k captures under 150ms", () => {
    const ms = measure("parseQuickAdd × 2000", 150, () => {
      for (let i = 0; i < 2000; i++) {
        parseQuickAdd("buy milk !high #errands tomorrow " + i, DAY);
      }
    });
    expect(ms).toBeLessThan(150);
  });

  it("publishes the measurements", () => {
    // Printed in test output as the evidence trail for the audit report.

    console.log(
      "\n[perf] " +
        rows.map((r) => `${r.label}: ${r.ms}ms (budget ${r.budget}ms)`).join("\n[perf] "),
    );
    expect(rows.length).toBeGreaterThan(0);
  });
});
