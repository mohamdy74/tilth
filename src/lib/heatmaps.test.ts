import { describe, expect, it } from "vitest";
import { buildHeatmap, buildYearHeatmap } from "./heatmaps";
import type { Habit, HabitLog } from "./types";

const today = "2026-11-16"; // Monday
const mkHabit = (schedule: Habit["schedule"]): Habit => ({
  id: "h",
  createdAt: today + "T08:00:00Z",
  updatedAt: today + "T08:00:00Z",
  name: "Walk",
  schedule,
  archived: false,
});
const log = (day: string, status: HabitLog["status"]): HabitLog => ({
  id: "l" + day,
  habitId: "h",
  localDay: day,
  status,
  createdAt: day + "T08:00:00Z",
  updatedAt: day + "T08:00:00Z",
});

describe("heatmaps", () => {
  it("empty logs -> 7 cells per column, week count right", () => {
    const hm = buildHeatmap({
      habit: mkHabit({ type: "daily", days: [0, 1, 2, 3, 4, 5, 6] }),
      logs: [],
      today,
      weekStartsOn: 1,
      weeks: 2,
    });
    expect(hm.columns).toHaveLength(2);
    expect(hm.columns.every((c) => c.days.length === 7)).toBe(true);
  });

  it("first column weekStart = startOfWeek(today) minus (weeks-1)*7", () => {
    const hm = buildHeatmap({
      habit: mkHabit({ type: "daily", days: [0, 1, 2, 3, 4, 5, 6] }),
      logs: [],
      today,
      weekStartsOn: 1,
      weeks: 1,
    });
    // weekStartsOn=1 -> Monday. Monday 2026-11-16 is today itself.
    expect(hm.columns[0]!.weekStart).toBe("2026-11-16");
  });

  it("done log -> done cell", () => {
    const hm = buildHeatmap({
      habit: mkHabit({ type: "daily", days: [0, 1, 2, 3, 4, 5, 6] }),
      logs: [log(today, "done")],
      today,
      weekStartsOn: 1,
      weeks: 1,
    });
    const cell = hm.columns[0]!.days.find((d) => d.day === today)!;
    expect(cell.status).toBe("done");
  });

  it("skipped log -> skipped cell", () => {
    const hm = buildHeatmap({
      habit: mkHabit({ type: "daily", days: [0, 1, 2, 3, 4, 5, 6] }),
      logs: [log(today, "skipped")],
      today,
      weekStartsOn: 1,
      weeks: 1,
    });
    expect(hm.columns[0]!.days.find((d) => d.day === today)!.status).toBe("skipped");
  });

  it("past scheduled day with no log -> missed", () => {
    const hm = buildHeatmap({
      habit: mkHabit({ type: "daily", days: [0, 1, 2, 3, 4, 5, 6] }),
      logs: [],
      today,
      weekStartsOn: 1,
      weeks: 2,
    });
    // last Monday (2026-11-09) is past, scheduled, no log -> missed
    expect(hm.columns[0]!.days.find((d) => d.day === "2026-11-09")!.status).toBe("missed");
  });

  it("future day -> upcoming", () => {
    const hm = buildHeatmap({
      habit: mkHabit({ type: "daily", days: [0, 1, 2, 3, 4, 5, 6] }),
      logs: [],
      today,
      weekStartsOn: 1,
      weeks: 1,
    });
    expect(hm.columns[0]!.days[6]!.status).toBe("upcoming");
  });

  it("a done log beats upcoming for a future day", () => {
    const hm = buildHeatmap({
      habit: mkHabit({ type: "daily", days: [0, 1, 2, 3, 4, 5, 6] }),
      logs: [log("2026-11-18", "done")],
      today,
      weekStartsOn: 1,
      weeks: 1,
    });
    const cell = hm.columns[0]!.days.find((d) => d.day === "2026-11-18")!;
    expect(cell.status).toBe("done");
  });

  it("not scheduled day -> not-scheduled", () => {
    const hm = buildHeatmap({
      habit: mkHabit({ type: "custom", days: [5] }),
      logs: [],
      today,
      weekStartsOn: 1,
      weeks: 1,
    });
    expect(hm.columns[0]!.days.find((d) => d.day === today)!.status).toBe("not-scheduled");
  });

  it("soft-deleted logs ignored", () => {
    const hm = buildHeatmap({
      habit: mkHabit({ type: "daily", days: [0, 1, 2, 3, 4, 5, 6] }),
      logs: [{ ...log(today, "done"), deletedAt: today + "T09:00:00Z" }],
      today,
      weekStartsOn: 1,
      weeks: 1,
    });
    expect(hm.columns[0]!.days.find((d) => d.day === today)!.status).toBe("missed");
  });

  it("consistency null when nothing scheduled", () => {
    const hm = buildHeatmap({
      habit: mkHabit({ type: "custom", days: [] }),
      logs: [],
      today,
      weekStartsOn: 1,
      weeks: 1,
    });
    expect(hm.consistency).toBeNull();
  });

  it("consistency 0 when everything scheduled was skipped", () => {
    const hm = buildHeatmap({
      habit: mkHabit({ type: "custom", days: [1] }),
      logs: [log(today, "skipped")],
      today,
      weekStartsOn: 1,
      weeks: 1,
    });
    expect(hm.consistency).toBe(0);
  });

  it("consistency 0.5 for 2 scheduled days, 1 done, 0 skipped", () => {
    // custom days [1] = Monday; weeks=2 covers Mon 11-16 (today, done) and
    // Mon 11-23 (future, upcoming but scheduled) -> scheduledCount=2.
    const hm = buildHeatmap({
      habit: mkHabit({ type: "custom", days: [1] }),
      logs: [log(today, "done")],
      today,
      weekStartsOn: 1,
      weeks: 2,
    });
    expect(hm.consistency).toBe(0.5);
  });

  it("year view is 52 weeks", () => {
    const hm = buildYearHeatmap({
      habit: mkHabit({ type: "daily", days: [0, 1, 2, 3, 4, 5, 6] }),
      logs: [],
      today,
      weekStartsOn: 1,
    });
    expect(hm.columns).toHaveLength(52);
  });
});
