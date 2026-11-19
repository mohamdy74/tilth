/*
 * Activity heatmap engine: a GitHub-style contribution grid over the last
 * 52 weeks (364 days), one cell per day. Each cell's intensity (0-4) is
 * driven by stored localDay strings only — never recomputed from the wall
 * clock. Activity counts completed tasks, done habit logs and completed
 * work focus sessions on that day.
 *
 * Pure — `today`, `weekStartsOn`, `dayStartHour` and `timeZone` are passed
 * in. Returns oldest-first, one entry per calendar day.
 */

import { addDays, startOfWeek, toLocalDay } from "./dates";
import type { FocusSession, Habit, HabitLog, LocalDay, Task } from "./types";

/** One cell of the heatmap grid. */
export interface ActivityCell {
  day: LocalDay;
  /** Total activities recorded on this day. */
  count: number;
  /** Intensity level 0-4 (0 = nothing, 4 = most). */
  level: number;
}

/** Number of weeks in the grid (a full year). */
export const HEAT_WEEKS = 52;
export const HEAT_DAYS = 7;

/** Map a raw activity count to a 0-4 intensity level. */
export function activityLevel(count: number): number {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

/** Aggregate all activity into a per-day count map. */
function activityCounts(
  tasks: Task[],
  habits: Habit[],
  habitLogs: HabitLog[],
  sessions: FocusSession[],
  opts: { dayStartHour: number; timeZone: string },
): Map<LocalDay, number> {
  const by = new Map<LocalDay, number>();
  const add = (day: LocalDay) => by.set(day, (by.get(day) ?? 0) + 1);

  for (const t of tasks) {
    if (t.deletedAt || t.status !== "done" || t.completedAt === undefined) continue;
    add(toLocalDay(new Date(t.completedAt), opts.dayStartHour, opts.timeZone));
  }
  for (const h of habits) {
    if (h.deletedAt || h.archived) continue;
    // Habits are counted via their logs (one done per day max), not the habit row.
  }
  for (const l of habitLogs) {
    if (l.deletedAt || l.status !== "done") continue;
    add(l.localDay);
  }
  for (const s of sessions) {
    if (s.deletedAt || !s.completed || s.mode === "break") continue;
    add(s.localDay);
  }
  return by;
}

/** 52 weeks x 7 days of activity, oldest first. */
export function activityHeatmap(
  tasks: Task[],
  habits: Habit[],
  habitLogs: HabitLog[],
  sessions: FocusSession[],
  opts: {
    today: LocalDay;
    weekStartsOn: number;
    dayStartHour: number;
    timeZone: string;
  },
): ActivityCell[] {
  const counts = activityCounts(tasks, habits, habitLogs, sessions, {
    dayStartHour: opts.dayStartHour,
    timeZone: opts.timeZone,
  });
  const start = startOfWeek(addDays(opts.today, -(HEAT_WEEKS - 1) * 7), opts.weekStartsOn);
  const cells: ActivityCell[] = [];
  for (let i = 0; i < HEAT_WEEKS * HEAT_DAYS; i++) {
    const day = addDays(start, i);
    const count = counts.get(day) ?? 0;
    cells.push({ day, count, level: activityLevel(count) });
  }
  return cells;
}
