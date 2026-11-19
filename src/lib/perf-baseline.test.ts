import { describe, expect, it } from "vitest";
import {
  todaysPriorities,
  dailyProgress,
  upcomingDeadlines,
  habitsDueToday,
} from "@/lib/dashboard";
import { habitStreaks, consistency30 } from "@/lib/streaks";
import { insightsReport, weeklyReview } from "@/lib/insights";
import { workMinutesToday } from "@/lib/focusTime";
import { parseQuickAdd } from "@/lib/quickAdd";
import type { Task, Habit, HabitLog, FocusSession } from "@/lib/types";

const today = "2026-11-16";

function task(overrides: Partial<Task> = {}): Task {
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

const largeTaskList = Array.from({ length: 1000 }, (_, i) =>
  task({ id: "t" + i, title: "Task " + i, dueDate: today }),
);

describe("engine performance baselines", () => {
  it("dashboard calculations stay fast on 1000 tasks", () => {
    const start = performance.now();
    todaysPriorities(largeTaskList, today);
    dailyProgress(largeTaskList, [], [], today);
    upcomingDeadlines(largeTaskList, today);
    habitsDueToday([], [], today);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100); // dashboard math well under 100ms
  });

  it("streaks stay fast on 1000 habit logs", () => {
    const logs = Array.from({ length: 1000 }, (_, i) =>
      log({
        id: "l" + i,
        localDay:
          "2026-" +
          String(10 + Math.floor(i / 30)).padStart(2, "0") +
          "-" +
          String((i % 30) + 1).padStart(2, "0"),
        status: "done",
      }),
    );
    const h = habit();
    const start = performance.now();
    habitStreaks(h, logs, today, 1);
    consistency30(h, logs, today);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it("insights report stays fast on 1000 tasks + sessions", () => {
    const doneTasks = largeTaskList.map((t) =>
      task({ id: t.id, status: "done", completedAt: today + "T10:00:00Z" }),
    );
    const sessions = Array.from({ length: 1000 }, (_, i) =>
      session({ id: "s" + i, localDay: today }),
    );
    const start = performance.now();
    insightsReport({
      tasks: doneTasks,
      habits: [habit()],
      habitLogs: [log()],
      focusSessions: sessions,
      xpLedger: [],
      today,
      timeZone: "UTC",
      dayStartHour: 0,
    });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(150);
  });

  it("weekly review stays fast on large dataset", () => {
    const start = performance.now();
    weeklyReview({
      tasks: largeTaskList,
      habits: [habit()],
      habitLogs: [log()],
      focusSessions: [session()],
      xpLedger: [],
      today,
      weekStartsOn: 1,
      dayStartHour: 0,
      timeZone: "UTC",
    });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(150);
  });

  it("focus time calculations stay fast", () => {
    const sessions = Array.from({ length: 1000 }, (_, i) => session({ id: "s" + i }));
    const start = performance.now();
    workMinutesToday(sessions, today);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it("quickAdd parse stays fast", () => {
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      parseQuickAdd("buy milk !high #errands tomorrow #work call Sam today", today);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200); // 10k parses under 200ms
  });
});
