import { describe, expect, it } from "vitest";
import { activityHeatmap, activityLevel, HEAT_DAYS, HEAT_WEEKS } from "./activityHeatmap";
import type { FocusSession, Habit, HabitLog, LocalDay, Priority, Task, TaskStatus } from "./types";

const today: LocalDay = "2026-11-16";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "id",
    title: "Task",
    priority: "medium" as Priority,
    tags: [],
    subtasks: [],
    status: "todo" as TaskStatus,
    completedAt: undefined,
    createdAt: "2026-11-01T08:00:00Z",
    updatedAt: "2026-11-01T08:00:00Z",
    kanbanOrder: 0,
    ...overrides,
  };
}

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Habit",
    schedule: { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
    archived: false,
    createdAt: "2026-11-01T08:00:00Z",
    updatedAt: "2026-11-01T08:00:00Z",
    ...overrides,
  };
}

function log(overrides: Partial<HabitLog> = {}): HabitLog {
  return {
    id: "l1",
    habitId: "h1",
    localDay: today,
    status: "done",
    createdAt: "2026-11-01T08:00:00Z",
    updatedAt: "2026-11-01T08:00:00Z",
    ...overrides,
  };
}

function session(overrides: Partial<FocusSession> = {}): FocusSession {
  return {
    id: "s1",
    mode: "pomodoro",
    plannedMinutes: 25,
    startedAt: "2026-11-16T09:00:00Z",
    endsAt: "2026-11-16T09:25:00Z",
    completed: true,
    distractions: [],
    linkedTaskId: undefined,
    localDay: today,
    createdAt: "2026-11-16T09:00:00Z",
    updatedAt: "2026-11-16T09:00:00Z",
    ...overrides,
  };
}

const opts = { today, weekStartsOn: 1, dayStartHour: 0, timeZone: "UTC" };

describe("activityLevel", () => {
  it("maps counts to 0-4 intensity", () => {
    expect(activityLevel(0)).toBe(0);
    expect(activityLevel(1)).toBe(1);
    expect(activityLevel(2)).toBe(1);
    expect(activityLevel(3)).toBe(2);
    expect(activityLevel(5)).toBe(2);
    expect(activityLevel(6)).toBe(3);
    expect(activityLevel(9)).toBe(3);
    expect(activityLevel(10)).toBe(4);
    expect(activityLevel(100)).toBe(4);
  });
});

describe("activityHeatmap", () => {
  it("returns exactly 52*7 cells, oldest first", () => {
    const cells = activityHeatmap([], [], [], [], opts);
    expect(cells.length).toBe(HEAT_WEEKS * HEAT_DAYS);
    expect(cells[0].day).toBe("2025-11-24");
    expect(cells[cells.length - 1].day).toBe("2026-11-22");
    expect(cells.every((c) => c.level >= 0 && c.level <= 4)).toBe(true);
  });

  it("counts a completed task on its completion day", () => {
    const tasks = [task({ status: "done", completedAt: today + "T10:00:00Z" })];
    const cells = activityHeatmap(tasks, [], [], [], opts);
    const cell = cells.find((c) => c.day === today);
    expect(cell?.count).toBe(1);
    expect(cell?.level).toBe(1);
  });

  it("accumulates multiple activities on the same day", () => {
    const tasks = [
      task({ status: "done", completedAt: today + "T08:00:00Z" }),
      task({ status: "done", completedAt: today + "T14:00:00Z" }),
    ];
    const logs = [log({ localDay: today, status: "done" })];
    const sessions = [session()];
    const cells = activityHeatmap(tasks, [], logs, sessions, opts);
    const cell = cells.find((c) => c.day === today);
    expect(cell?.count).toBe(4);
    expect(cell?.level).toBe(2);
  });

  it("ignores soft-deleted and non-completed records", () => {
    const tasks = [
      task({
        status: "done",
        completedAt: today + "T08:00:00Z",
        deletedAt: "2026-11-16T09:00:00Z",
      }),
      task({ status: "todo" }),
    ];
    const cells = activityHeatmap(tasks, [], [], [], opts);
    expect(cells.find((c) => c.day === today)?.count).toBe(0);
  });

  it("counts habit done logs and completed work sessions only", () => {
    const logs = [
      log({ localDay: today, status: "done" }),
      log({ localDay: today, status: "skipped" }),
    ];
    const sessions = [session(), session({ mode: "break", completed: true })];
    const cells = activityHeatmap([], [], logs, sessions, opts);
    const cell = cells.find((c) => c.day === today);
    // 1 done habit log + 1 completed work session (break excluded)
    expect(cell?.count).toBe(2);
  });
});
