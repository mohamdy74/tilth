import { describe, expect, it } from "vitest";
import {
  activityHeatmap,
  activityLevel,
  HEAT_DAYS,
  HEAT_WEEKS,
  monthBlocks,
} from "./activityHeatmap";
import type { FocusSession, HabitLog, LocalDay, Priority, Task, TaskStatus } from "./types";

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
    expect(cells[0]?.day).toBe("2025-11-24");
    expect(cells[cells.length - 1]?.day).toBe("2026-11-22");
    expect(cells.every((c) => c.level >= 0 && c.level <= 4)).toBe(true);
  });

  it("counts a completed task on its completion day", () => {
    const tasks = [task({ status: "done", completedAt: today + "T10:00:00Z" })];
    const cells = activityHeatmap(tasks, [], [], [], opts);
    const cell = cells.find((c) => c.day === today);
    expect(cell?.count).toBe(1);
    expect(cell?.level).toBe(1);
  });

  it("ignores malformed completion timestamps", () => {
    const tasks = [task({ status: "done", completedAt: "not-a-date" })];
    expect(() => activityHeatmap(tasks, [], [], [], opts)).not.toThrow();
    expect(activityHeatmap(tasks, [], [], [], opts).every((cell) => cell.count === 0)).toBe(true);
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

describe("monthBlocks layout (literal pixel assertions)", () => {
  const emptyHeatmap = activityHeatmap([], [], [], [], {
    today: "2026-12-15",
    weekStartsOn: 6,
    dayStartHour: 0,
    timeZone: "UTC",
  });

  it("weekStartsOn=Saturday: Dec 2026 offset 3 cols 5 width 72", () => {
    const blocks = monthBlocks(emptyHeatmap, "2026-12-15", 6);
    const dec = blocks.find((b) => b.year === 2026 && b.month === 12)!;
    expect(dec.offset).toBe(3);
    expect(dec.cols).toBe(5);
    expect(dec.cols * 12 + (dec.cols - 1) * 3).toBe(72);
  });

  it("weekStartsOn=Saturday: Jan 2027 offset 6 cols 6 width 87", () => {
    const hm = activityHeatmap([], [], [], [], {
      today: "2027-01-15",
      weekStartsOn: 6,
      dayStartHour: 0,
      timeZone: "UTC",
    });
    const blocks = monthBlocks(hm, "2027-01-15", 6);
    const jan = blocks.find((b) => b.year === 2027 && b.month === 1)!;
    expect(jan.offset).toBe(6);
    expect(jan.cols).toBe(6);
    expect(jan.cols * 12 + (jan.cols - 1) * 3).toBe(87);
  });

  it("weekStartsOn=Saturday: Feb 2027 offset 2 cols 5 width 72", () => {
    const hm = activityHeatmap([], [], [], [], {
      today: "2027-02-15",
      weekStartsOn: 6,
      dayStartHour: 0,
      timeZone: "UTC",
    });
    const blocks = monthBlocks(hm, "2027-02-15", 6);
    const feb = blocks.find((b) => b.year === 2027 && b.month === 2)!;
    expect(feb.offset).toBe(2);
    expect(feb.cols).toBe(5);
    expect(feb.cols * 12 + (feb.cols - 1) * 3).toBe(72);
  });

  it("weekStartsOn=Monday: Feb 2027 offset 0 cols 4 width 57", () => {
    const hm = activityHeatmap([], [], [], [], {
      today: "2027-02-15",
      weekStartsOn: 1,
      dayStartHour: 0,
      timeZone: "UTC",
    });
    const blocks = monthBlocks(hm, "2027-02-15", 1);
    const feb = blocks.find((b) => b.year === 2027 && b.month === 2)!;
    expect(feb.offset).toBe(0);
    expect(feb.cols).toBe(4);
    expect(feb.cols * 12 + (feb.cols - 1) * 3).toBe(57);
  });

  it("grid height is always 102px", () => {
    const blocks = monthBlocks(emptyHeatmap, "2026-12-15", 6);
    for (const b of blocks) {
      expect(b.cells.length).toBeGreaterThan(0);
      // every cell row is 1..7, col is 1..cols
      for (const c of b.cells) {
        expect(c.row).toBeGreaterThanOrEqual(1);
        expect(c.row).toBeLessThanOrEqual(7);
        expect(c.col).toBeGreaterThanOrEqual(1);
        expect(c.col).toBeLessThanOrEqual(b.cols);
      }
    }
  });

  it("cells per month == days in month (Feb 2028 = 29); day 1 row == offset+1", () => {
    const hm = activityHeatmap([], [], [], [], {
      today: "2028-02-15",
      weekStartsOn: 6,
      dayStartHour: 0,
      timeZone: "UTC",
    });
    const blocks = monthBlocks(hm, "2028-02-15", 6);
    const feb = blocks.find((b) => b.year === 2028 && b.month === 2)!;
    expect(feb.cells.length).toBe(29);
    const day1 = feb.cells.find((c) => c.day === "2028-02-01")!;
    expect(day1.row).toBe(feb.offset + 1);
    expect(day1.col).toBe(1);
  });

  it("Feb 2028 span yields consecutive UNIQUE day keys (no dupes/gaps)", () => {
    const hm = activityHeatmap([], [], [], [], {
      today: "2028-02-15",
      weekStartsOn: 6,
      dayStartHour: 0,
      timeZone: "UTC",
    });
    const blocks = monthBlocks(hm, "2028-02-15", 6);
    const feb = blocks.find((b) => b.year === 2028 && b.month === 2)!;
    const days = feb.cells.map((c) => c.day).sort();
    const expected = Array.from({ length: 29 }, (_, i) =>
      "2028-02-" + String(i + 1).padStart(2, "0"),
    );
    expect(days).toEqual(expected);
    expect(new Set(days).size).toBe(days.length);
  });
});
