import { describe, expect, it } from "vitest";
import { suggestTaskStart, topCompletionHour } from "./energy";
import type { LocalDay, Task } from "./types";

const today: LocalDay = "2026-11-16";
const opts = { today, days: 28, dayStartHour: 0, timeZone: "UTC" };

function task(overrides: Partial<Task>): Task {
  return {
    id: "id",
    title: "Task",
    priority: "medium",
    tags: [],
    subtasks: [],
    status: "todo",
    completedAt: undefined,
    createdAt: "2026-11-01T08:00:00Z",
    updatedAt: "2026-11-01T08:00:00Z",
    kanbanOrder: 0,
    ...overrides,
  };
}

describe("topCompletionHour", () => {
  it("returns undefined when no done tasks", () => {
    expect(topCompletionHour([task({ status: "done", completedAt: undefined })], opts)).toBe(
      undefined,
    );
  });

  it("picks the most common completion hour", () => {
    const at = (hour: number) => "2026-11-15T" + String(hour).padStart(2, "0") + ":00:00Z";
    const tasks = [
      task({ status: "done", completedAt: at(9) }),
      task({ status: "done", completedAt: at(9) }),
      task({ status: "done", completedAt: at(14) }),
    ];
    expect(topCompletionHour(tasks, opts)).toBe(9);
  });

  it("respects the day window", () => {
    const at = (day: LocalDay, hour: number) =>
      day + "T" + String(hour).padStart(2, "0") + ":00:00Z";
    const tasks = [
      task({ status: "done", completedAt: at("2026-10-20", 9) }), // outside 28-day window
      task({ status: "done", completedAt: at("2026-11-10", 14) }),
      task({ status: "done", completedAt: at("2026-11-10", 14) }),
    ];
    expect(topCompletionHour(tasks, opts)).toBe(14);
  });
});

describe("suggestTaskStart", () => {
  it("returns undefined for pinned or done tasks", () => {
    const pinned = task({ blockStart: 540 });
    expect(suggestTaskStart(pinned, [pinned], opts)).toBeUndefined();
    const done = task({ status: "done", completedAt: "2026-11-15T09:00:00Z" });
    expect(suggestTaskStart(done, [done], opts)).toBeUndefined();
  });

  it("suggests a clamped work-window minute", () => {
    const t = task({ priority: "high" });
    const history = [
      task({ status: "done", completedAt: "2026-11-10T22:00:00Z" }), // late -> clamped to 18:00
      task({ status: "done", completedAt: "2026-11-10T22:30:00Z" }),
    ];
    const s = suggestTaskStart(t, history, opts);
    expect(s).toBeDefined();
    expect(s!.startMinute).toBe(18 * 60);
    expect(s!.label).toBe("18:00");
  });
});
