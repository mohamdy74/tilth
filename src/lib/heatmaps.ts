import { addDays, startOfWeek } from "./dates";
import { isScheduledOn } from "./streaks";
import type { Habit, HabitLog, LocalDay } from "./types";

/*
 * Pure heatmap engine. Powers the 12-week heatmap and the year view on
 * /habits. A day's status is distinct beyond color; every cell is driven by
 * the STORED localDay strings only.
 */

export type HeatStatus = "done" | "skipped" | "missed" | "upcoming" | "not-scheduled";

export interface HeatCell {
  day: LocalDay;
  status: HeatStatus;
  scheduled: boolean;
  future: boolean;
}

export interface HeatColumn {
  weekStart: LocalDay;
  days: HeatCell[]; // exactly 7, index 0 = the weekday the week starts on
}

export interface HabitHeatmap {
  columns: HeatColumn[];
  totalDone: number;
  totalMissed: number;
  totalSkipped: number;
  /** done / (scheduled - skipped) over the window; null when nothing was scheduled. */
  consistency: number | null;
}

export function buildHeatmap(input: {
  habit: Habit;
  logs: HabitLog[];
  today: LocalDay;
  weekStartsOn: number;
  weeks: number;
}): HabitHeatmap {
  const { habit, today, weekStartsOn, weeks } = input;
  const firstWeekStart = addDays(startOfWeek(today, weekStartsOn), -(weeks - 1) * 7);
  const logByDay = new Map<LocalDay, HabitLog["status"]>();
  for (const l of input.logs) {
    if (l.deletedAt || l.habitId !== habit.id) continue;
    logByDay.set(l.localDay, l.status);
  }

  const columns: HeatColumn[] = [];
  let totalDone = 0;
  let totalMissed = 0;
  let totalSkipped = 0;
  let scheduledCount = 0;
  let skippedCount = 0;

  for (let w = 0; w < weeks; w++) {
    const weekStart = addDays(firstWeekStart, w * 7);
    const days: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(weekStart, d);
      const scheduled = isScheduledOn(habit.schedule, day);
      const future = day > today;
      const status: HeatStatus = !scheduled
        ? "not-scheduled"
        : logByDay.get(day) === "done"
          ? "done"
          : logByDay.get(day) === "skipped"
            ? "skipped"
            : future
              ? "upcoming"
              : "missed";
      if (scheduled) scheduledCount++;
      if (status === "done") totalDone++;
      else if (status === "missed") totalMissed++;
      else if (status === "skipped") {
        totalSkipped++;
        skippedCount++;
      }
      days.push({ day, status, scheduled, future });
    }
    columns.push({ weekStart, days });
  }

  const denom = scheduledCount - skippedCount;
  const consistency =
    scheduledCount === 0 ? null : Math.round((totalDone / Math.max(denom, 1)) * 10000) / 10000;

  return { columns, totalDone, totalMissed, totalSkipped, consistency };
}

export function buildYearHeatmap(input: {
  habit: Habit;
  logs: HabitLog[];
  today: LocalDay;
  weekStartsOn: number;
}): HabitHeatmap {
  return buildHeatmap({ ...input, weeks: 52 });
}
