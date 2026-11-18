import { describe, expect, it } from "vitest";
import { buildDayPlan, formatClock, layoutDayPlan, type PlanBlock } from "./plan";
import type { Habit, HabitLog, LocalDay, Task } from "./types";

const today: LocalDay = "2026-11-16"; // Monday

const mkTask = (over: Partial<Task>): Task => ({
  id: "t1",
  createdAt: today + "T08:00:00Z",
  updatedAt: today + "T08:00:00Z",
  title: "Task",
  priority: "medium",
  tags: [],
  subtasks: [],
  status: "todo",
  kanbanOrder: 0,
  ...over,
});

const mkHabit = (id: string, schedule: Habit["schedule"]): Habit => ({
  id,
  createdAt: today + "T08:00:00Z",
  updatedAt: today + "T08:00:00Z",
  name: "Habit " + id,
  schedule,
  archived: false,
});

describe("plan", () => {
  it("empty input -> empty plan", () => {
    const p = buildDayPlan({
      today,
      tasks: [],
      habits: [],
      habitLogs: [],
      focusTargetMinutes: 0,
      dayStartHour: 0,
    });
    expect(p.blocks).toEqual([]);
    expect(p.totalMinutes).toBe(0);
    expect(p.overflowTasks).toEqual([]);
    expect(p.startMinute).toBe(9 * 60);
    expect(p.endMinute).toBe(9 * 60);
  });

  it("overdue task is scheduled; undated task is not", () => {
    const overdue = mkTask({ id: "o", title: "Overdue", dueDate: "2026-11-14", status: "todo" });
    const undated = mkTask({ id: "u", title: "Undated" });
    const p = buildDayPlan({
      today,
      tasks: [overdue, undated],
      habits: [],
      habitLogs: [],
      focusTargetMinutes: 0,
      dayStartHour: 0,
    });
    expect(p.blocks.map((b) => b.title)).toEqual(["Overdue"]);
    expect(p.totalMinutes).toBe(25);
  });

  it("priority ordering: high before medium before low", () => {
    const p = buildDayPlan({
      today,
      tasks: [
        mkTask({ id: "l", title: "Low", dueDate: today, priority: "low" }),
        mkTask({ id: "h", title: "High", dueDate: today, priority: "high" }),
        mkTask({ id: "m", title: "Med", dueDate: today, priority: "medium" }),
      ],
      habits: [],
      habitLogs: [],
      focusTargetMinutes: 0,
      dayStartHour: 0,
    });
    expect(p.blocks.map((b) => b.title)).toEqual(["High", "Med", "Low"]);
  });

  it("estimate math: subtasks add minutes", () => {
    const p = buildDayPlan({
      today,
      tasks: [
        mkTask({ id: "h", title: "High", dueDate: today, priority: "high" }),
        mkTask({
          id: "m",
          title: "Med",
          dueDate: today,
          priority: "medium",
          subtasks: [
            { id: "s1", title: "x", done: false },
            { id: "s2", title: "y", done: false },
          ],
        }),
      ],
      habits: [],
      habitLogs: [],
      focusTargetMinutes: 0,
      dayStartHour: 0,
    });
    expect(p.blocks.find((b) => b.title === "High")!.minutes).toBe(45);
    expect(p.blocks.find((b) => b.title === "Med")!.minutes).toBe(45);
  });

  it("capacity: extra tasks go to overflow in order", () => {
    const p = buildDayPlan({
      today,
      tasks: Array.from({ length: 10 }, (_, i) =>
        mkTask({ id: `t${i}`, title: `T${i}`, dueDate: today, priority: "low" }),
      ),
      habits: [],
      habitLogs: [],
      focusTargetMinutes: 0,
      dayStartHour: 0,
      startMinute: 9 * 60,
      endOfDayMinute: 9 * 60 + 2 * 15, // two tasks fit
    });
    expect(p.blocks.length).toBe(2);
    expect(p.overflowTasks).toEqual(["T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9"]);
  });

  it("habits scheduled today appear; unscheduled ones don't", () => {
    const daily = mkHabit("d", { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] });
    const weekly = mkHabit("w", { type: "custom", days: [5] }); // Saturday
    const p = buildDayPlan({
      today,
      tasks: [],
      habits: [daily, weekly],
      habitLogs: [],
      focusTargetMinutes: 0,
      dayStartHour: 0,
    });
    expect(p.blocks.map((b) => b.title)).toContain("Habit d");
    expect(p.blocks.map((b) => b.title)).not.toContain("Habit w");
  });

  it("done habit today is marked done but still appears", () => {
    const h = mkHabit("d", { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] });
    const logs: HabitLog[] = [
      {
        id: "l",
        habitId: "d",
        localDay: today,
        status: "done",
        createdAt: today + "T08:00:00Z",
        updatedAt: today + "T08:00:00Z",
      },
    ];
    const p = buildDayPlan({
      today,
      tasks: [],
      habits: [h],
      habitLogs: logs,
      focusTargetMinutes: 0,
      dayStartHour: 0,
    });
    const b = p.blocks.find((x) => x.kind === "habit")!;
    expect(b.done).toBe(true);
  });

  it("focus block gets a 15-minute gap before it", () => {
    const p = buildDayPlan({
      today,
      tasks: [mkTask({ id: "x", title: "X", dueDate: today, priority: "low" })],
      habits: [],
      habitLogs: [],
      focusTargetMinutes: 25,
      dayStartHour: 0,
      startMinute: 9 * 60,
      endOfDayMinute: 22 * 60,
    });
    const focus = p.blocks.find((b) => b.kind === "focus")!;
    const task = p.blocks.find((b) => b.kind === "task")!;
    expect(focus.startMinute).toBe(task.startMinute + task.minutes + 15);
    expect(p.scheduledMinutes).toBe(25);
  });
});

const mkBlock = (
  over: Partial<PlanBlock> & Pick<PlanBlock, "id" | "startMinute" | "minutes">,
): PlanBlock => ({
  kind: "task",
  title: over.id,
  priority: undefined,
  done: false,
  sourceId: over.id,
  ...over,
});

describe("layoutDayPlan", () => {
  it("empty input -> full-day height, no lanes", () => {
    const l = layoutDayPlan([]);
    expect(l.blocks).toEqual([]);
    expect(l.laneCount).toBe(0);
    expect(l.height).toBe(13 * 64);
  });

  it("sequential blocks use one lane at their true offsets", () => {
    const l = layoutDayPlan([
      mkBlock({ id: "a", startMinute: 9 * 60, minutes: 45 }),
      mkBlock({ id: "b", startMinute: 10 * 60, minutes: 30 }),
    ]);
    expect(l.blocks.map((b) => b.lane)).toEqual([0, 0]);
    expect(l.blocks.map((b) => b.lanes)).toEqual([1, 1]);
    expect(l.blocks[0]!.top).toBe(0);
    expect(l.blocks[0]!.height).toBe(48);
    expect(l.blocks[1]!.top).toBe(64);
  });

  it("a 15-minute block keeps its top but grows to the minimum height", () => {
    const l = layoutDayPlan([mkBlock({ id: "a", startMinute: 11 * 60, minutes: 15 })]);
    expect(l.blocks[0]!.top).toBe(128);
    expect(l.blocks[0]!.height).toBe(28);
  });

  it("overlapping blocks split into columns at the same top", () => {
    const l = layoutDayPlan([
      mkBlock({ id: "a", startMinute: 9 * 60, minutes: 60 }),
      mkBlock({ id: "b", startMinute: 9 * 60 + 30, minutes: 60 }),
    ]);
    expect(l.blocks.map((b) => b.lane)).toEqual([0, 1]);
    expect(l.blocks.map((b) => b.lanes)).toEqual([2, 2]);
    expect(l.blocks[0]!.top).toBe(0);
    expect(l.blocks[1]!.top).toBe(32);
    expect(l.laneCount).toBe(2);
  });

  it("short back-to-back blocks split lanes when minimum height would collide", () => {
    const l = layoutDayPlan([
      mkBlock({ id: "a", startMinute: 12 * 60 + 30, minutes: 15 }),
      mkBlock({ id: "b", startMinute: 12 * 60 + 45, minutes: 15 }),
      mkBlock({ id: "c", startMinute: 13 * 60 + 10, minutes: 100 }),
    ]);
    // a: 224..252, b: 240..268, c: 267..374 (render pixels)
    expect(l.blocks.map((b) => [b.lane, b.lanes])).toEqual([
      [0, 2],
      [1, 2],
      [0, 2],
    ]);
    expect(l.blocks[0]!.top).toBe(224);
    expect(l.blocks[1]!.top).toBe(240);
    expect(l.blocks[2]!.top).toBeCloseTo(266.67, 1);
  });

  it("chained overlaps reuse the lowest free lane", () => {
    const l = layoutDayPlan([
      mkBlock({ id: "a", startMinute: 9 * 60, minutes: 60 }),
      mkBlock({ id: "b", startMinute: 9 * 60 + 30, minutes: 60 }),
      mkBlock({ id: "c", startMinute: 10 * 60 + 15, minutes: 45 }),
    ]);
    expect(l.blocks.map((b) => [b.block.id, b.lane, b.lanes])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 0, 2],
    ]);
    expect(l.laneCount).toBe(2);
  });

  it("respects a nonzero window start and does not mutate input", () => {
    const input = [mkBlock({ id: "a", startMinute: 12 * 60, minutes: 30 })];
    const l = layoutDayPlan(input, { startMinute: 10 * 60, hourPx: 32 });
    expect(l.blocks[0]!.top).toBe(64);
    expect(l.blocks[0]!.height).toBe(28); // 16px < minBlockPx
    expect(input[0]!.startMinute).toBe(12 * 60);
  });
});

describe("formatClock", () => {
  it("formats 24-hour time", () => {
    expect(formatClock("en", 9 * 60 + 5)).toBe("09:05");
  });

  it("formats 12-hour time", () => {
    expect(formatClock("en", 9 * 60 + 5, true)).toBe("09:05 AM");
  });

  it("uses Arabic-Indic digits in Arabic", () => {
    expect(formatClock("ar", 9 * 60)).toMatch(/[٠-٩]/);
  });
});

describe("time-blocking (blockStart)", () => {
  const base = {
    today,
    habits: [],
    habitLogs: [],
    focusTargetMinutes: 0,
    dayStartHour: 0,
  };

  it("pinned task lands at its requested minute", () => {
    const p = buildDayPlan({
      ...base,
      tasks: [mkTask({ id: "a", dueDate: today, blockStart: 14 * 60 })],
    });
    expect(p.blocks[0]!.startMinute).toBe(14 * 60);
  });

  it("flowing tasks skip occupied pinned intervals", () => {
    const p = buildDayPlan({
      ...base,
      tasks: [
        mkTask({ id: "a", dueDate: today, priority: "high", blockStart: 9 * 60 }),
        mkTask({ id: "b", dueDate: today, priority: "low" }),
      ],
    });
    const a = p.blocks.find((b) => b.sourceId === "a")!;
    const b = p.blocks.find((b) => b.sourceId === "b")!;
    expect(a.startMinute).toBe(9 * 60);
    expect(b.startMinute).toBeGreaterThanOrEqual(a.startMinute + a.minutes);
  });

  it("overlapping pins shift to the next free slot, never overlap", () => {
    const p = buildDayPlan({
      ...base,
      tasks: [
        mkTask({ id: "a", dueDate: today, blockStart: 10 * 60 }),
        mkTask({ id: "b", dueDate: today, blockStart: 10 * 60 }),
      ],
    });
    const [x, y] = [...p.blocks].sort((m, n) => m.startMinute - n.startMinute);
    expect(y!.startMinute).toBeGreaterThanOrEqual(x!.startMinute + x!.minutes);
  });

  it("blocks stay sorted by start minute", () => {
    const p = buildDayPlan({
      ...base,
      tasks: [
        mkTask({ id: "a", dueDate: today, blockStart: 15 * 60 }),
        mkTask({ id: "b", dueDate: today }),
      ],
    });
    for (let i = 1; i < p.blocks.length; i++) {
      expect(p.blocks[i]!.startMinute).toBeGreaterThanOrEqual(p.blocks[i - 1]!.startMinute);
    }
  });
});
