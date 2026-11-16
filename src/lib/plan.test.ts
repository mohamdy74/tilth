import { describe, expect, it } from "vitest";
import { buildDayPlan } from "./plan";
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
