import { describe, expect, it } from "vitest";
import { distractionsByDay } from "./distractionReview";
import type { FocusSession, LocalDay } from "./types";

const today: LocalDay = "2026-11-16";

function session(day: LocalDay, distractions: number): FocusSession {
  return {
    id: "s",
    mode: "pomodoro",
    plannedMinutes: 25,
    startedAt: day + "T09:00:00Z",
    endsAt: day + "T09:25:00Z",
    completed: true,
    distractions: Array.from({ length: distractions }, (_, i) => ({
      at: day + "T09:" + String(i).padStart(2, "0") + ":00Z",
    })),
    localDay: day,
    createdAt: day + "T09:00:00Z",
    updatedAt: day + "T09:00:00Z",
  };
}

describe("distractionsByDay", () => {
  it("aggregates distraction taps per stored day", () => {
    const sessions = [session("2026-11-14", 2), session("2026-11-14", 1), session("2026-11-15", 3)];
    const by = distractionsByDay(sessions, today);
    const map = new Map(by.map((d) => [d.day, d.count]));
    expect(map.get("2026-11-14")).toBe(3);
    expect(map.get("2026-11-15")).toBe(3);
    expect(map.get("2026-11-16")).toBe(0);
  });

  it("ignores deleted and incomplete sessions", () => {
    const sessions = [
      session("2026-11-14", 2),
      { ...session("2026-11-14", 5), id: "s2", deletedAt: "2026-11-14T10:00:00Z" },
      { ...session("2026-11-15", 1), id: "s3", completed: false },
    ];
    const by = distractionsByDay(sessions, today);
    const map = new Map(by.map((d) => [d.day, d.count]));
    expect(map.get("2026-11-14")).toBe(2);
    expect(map.get("2026-11-15")).toBe(0);
  });

  it("returns a point per day in the window", () => {
    const by = distractionsByDay([], today);
    expect(by.length).toBe(7);
    expect(by[0]?.day).toBe("2026-11-10");
    expect(by[6]?.day).toBe("2026-11-16");
    expect(by.every((d) => d.count === 0)).toBe(true);
  });
});
