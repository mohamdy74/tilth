import { describe, expect, it } from "vitest";
import {
  activityHeatmap,
  activityLevel,
  HEAT_DAYS,
  HEAT_WEEKS,
  monthBlocks,
  monthOptions,
  nextFocusDay,
  tier,
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

describe("T1: pure calendar month grid", () => {
  const cases = [
    { month: "2026-11-01", start: 6, offset: 1, rows: 5, height: 164, days: 30 },
    { month: "2026-12-01", start: 6, offset: 3, rows: 5, height: 164, days: 31 },
    { month: "2027-01-01", start: 6, offset: 6, rows: 6, height: 198, days: 31 },
    { month: "2027-02-01", start: 6, offset: 2, rows: 5, height: 164, days: 28 },
    { month: "2028-02-01", start: 6, offset: 3, rows: 5, height: 164, days: 29 },
    { month: "2027-02-01", start: 1, offset: 0, rows: 4, height: 130, days: 28 },
  ] as const;

  for (const testCase of cases) {
    it(`${testCase.month}, weekStartsOn=${testCase.start}: exact calendar geometry`, () => {
      const block = monthBlocks(new Map(), testCase.month, testCase.month, testCase.start);
      expect(block.offset).toBe(testCase.offset);
      expect(block.rows).toBe(testCase.rows);
      expect(block.rows * 28 + (block.rows - 1) * 6).toBe(testCase.height);
      expect(7 * 28 + 6 * 6).toBe(232);
      expect(block.cells).toHaveLength(testCase.days);
      expect(block.cells[0]).toMatchObject({ row: 1, col: testCase.offset + 1 });
      const positions = block.cells.map((cell) => `${cell.row},${cell.col}`);
      expect(new Set(positions).size).toBe(testCase.days);
    });
  }

  it("Nov 2026 last row contains exactly days 28, 29 and 30", () => {
    const block = monthBlocks(new Map(), "2026-11-01", "2026-11-19", 6);
    expect(block.cells.filter((cell) => cell.row === 5).map((cell) => cell.day)).toEqual([
      "2026-11-28",
      "2026-11-29",
      "2026-11-30",
    ]);
  });
});

describe("T2: three activity tiers", () => {
  it("maps 0, light and solid counts at the literal boundaries", () => {
    expect([tier(0), tier(1), tier(5), tier(6), tier(10), tier(25)]).toEqual([0, 1, 1, 2, 2, 2]);
  });
});

describe("T3: continuous month options", () => {
  const counts = (...days: LocalDay[]) => new Map(days.map((day) => [day, 1]));

  it("returns 12 months from 2026-11 through 2025-12", () => {
    expect(monthOptions("2026-11-19", counts("2025-12-14"))).toEqual([
      "2026-11",
      "2026-10",
      "2026-09",
      "2026-08",
      "2026-07",
      "2026-06",
      "2026-05",
      "2026-04",
      "2026-03",
      "2026-02",
      "2026-01",
      "2025-12",
    ]);
  });

  it("includes the new current month automatically", () => {
    const options = monthOptions("2026-12-01", counts("2025-12-14"));
    expect(options).toHaveLength(13);
    expect(options[0]).toBe("2026-12");
  });

  it("returns only the current month for same-month or empty data", () => {
    expect(monthOptions("2026-11-19", counts("2026-11-02"))).toEqual(["2026-11"]);
    expect(monthOptions("2026-11-19", new Map())).toEqual(["2026-11"]);
  });

  it("crosses year boundaries without day-31 overflow", () => {
    expect(monthOptions("2026-03-01", counts("2026-01-31"))).toEqual([
      "2026-03",
      "2026-02",
      "2026-01",
    ]);
  });
});

describe("T5: calendar keyboard navigation", () => {
  it("clamps at the first day and a previous month's last day", () => {
    expect(nextFocusDay("2026-10-01", "ArrowLeft", "2026-11-19", 31)).toBe("2026-10-01");
    expect(nextFocusDay("2026-10-01", "ArrowUp", "2026-11-19", 31)).toBe("2026-10-01");
    expect(nextFocusDay("2026-10-31", "ArrowRight", "2026-11-19", 31)).toBe("2026-10-31");
    expect(nextFocusDay("2026-10-31", "ArrowDown", "2026-11-19", 31)).toBe("2026-10-31");
    expect(nextFocusDay("2026-10-15", "End", "2026-11-19", 31)).toBe("2026-10-31");
  });

  it("clamps the current month at the last non-future day", () => {
    expect(nextFocusDay("2026-11-19", "ArrowRight", "2026-11-19", 30)).toBe("2026-11-19");
    expect(nextFocusDay("2026-11-18", "ArrowDown", "2026-11-19", 30)).toBe("2026-11-19");
    expect(nextFocusDay("2026-11-01", "End", "2026-11-19", 30)).toBe("2026-11-19");
  });

  it("moves by one day horizontally and seven days vertically", () => {
    expect(nextFocusDay("2026-11-10", "ArrowLeft", "2026-11-19", 30)).toBe("2026-11-09");
    expect(nextFocusDay("2026-11-10", "ArrowRight", "2026-11-19", 30)).toBe("2026-11-11");
    expect(nextFocusDay("2026-11-10", "ArrowUp", "2026-11-19", 30)).toBe("2026-11-03");
    expect(nextFocusDay("2026-11-10", "ArrowDown", "2026-11-19", 30)).toBe("2026-11-17");
    expect(nextFocusDay("2026-11-10", "Home", "2026-11-19", 30)).toBe("2026-11-01");
  });

  it("ignores unrelated keys and Shift variants", () => {
    expect(nextFocusDay("2026-11-10", "PageDown", "2026-11-19", 30)).toBeNull();
    expect(nextFocusDay("2026-11-10", "Shift+ArrowLeft", "2026-11-19", 30)).toBeNull();
  });
});
