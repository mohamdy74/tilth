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

import {
  addDays,
  addMonths,
  daysInMonth,
  isValidTimestamp,
  startOfMonth,
  startOfWeek,
  toLocalDay,
  weekdayOf,
} from "./dates";
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

export const HEAT_LIGHT_MAX = 5;

/** Map a raw activity count to the calendar's three color tiers. */
export function tier(count: number): number {
  if (count <= 0) return 0;
  return count <= HEAT_LIGHT_MAX ? 1 : 2;
}

/** Aggregate all activity into a per-day count map. Covers ALL history
 * (no 364-day slice) — callers decide the window. */
export function activityCounts(
  tasks: Task[],
  habits: Habit[],
  habitLogs: HabitLog[],
  sessions: FocusSession[],
  opts: { dayStartHour: number; timeZone: string },
): Map<LocalDay, number> {
  const by = new Map<LocalDay, number>();
  const add = (day: LocalDay) => by.set(day, (by.get(day) ?? 0) + 1);

  for (const t of tasks) {
    if (
      t.deletedAt ||
      t.status !== "done" ||
      t.completedAt === undefined ||
      !isValidTimestamp(t.completedAt)
    )
      continue;
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

/** One cell inside a month block, with explicit calendar placement. */
export interface MonthCell {
  day: LocalDay;
  row: number;
  col: number;
  count: number;
  tier: number;
  isPast: boolean; // day is on or before today
}

/** One calendar month: seven weekday columns and as many week rows as needed. */
export interface MonthBlock {
  year: number;
  month: number; // 1..12
  offset: number; // leading empty slots before day 1 (0..6)
  rows: number;
  cells: MonthCell[];
}

/** Build one month directly from the all-history per-day counts. */
export function monthBlocks(
  counts: Map<LocalDay, number>,
  month: LocalDay,
  today: LocalDay,
  weekStartsOn: number,
): MonthBlock {
  const firstDay = startOfMonth(month);
  const days = daysInMonth(firstDay);
  const offset = (weekdayOf(firstDay) - weekStartsOn + 7) % 7;
  const cells: MonthCell[] = [];
  for (let d = 1; d <= days; d++) {
    const day = addDays(firstDay, d - 1);
    const count = counts.get(day) ?? 0;
    cells.push({
      day,
      row: Math.floor((offset + d - 1) / 7) + 1,
      col: ((offset + d - 1) % 7) + 1,
      count,
      tier: tier(count),
      isPast: day <= today,
    });
  }
  return {
    year: Number(firstDay.slice(0, 4)),
    month: Number(firstDay.slice(5, 7)),
    offset,
    rows: Math.ceil((offset + days) / 7),
    cells,
  };
}

/** Continuous month keys from today back to the earliest activity, newest first. */
export function monthOptions(today: LocalDay, counts: Map<LocalDay, number>): string[] {
  const current = today.slice(0, 7);
  let earliest = current;
  for (const day of counts.keys()) {
    const key = day.slice(0, 7);
    if (key < earliest) earliest = key;
  }
  const options: string[] = [];
  let cursor = startOfMonth(today);
  while (cursor.slice(0, 7) >= earliest) {
    options.push(cursor.slice(0, 7));
    cursor = addMonths(cursor, -1);
  }
  return options;
}

/** Calendar keyboard movement, clamped inside the month and before future days. */
export function nextFocusDay(
  dayKey: LocalDay,
  key: string,
  today: LocalDay,
  daysInMonthCount: number,
): LocalDay | null {
  const delta: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7,
  };
  const last =
    dayKey.slice(0, 7) === today.slice(0, 7)
      ? Math.min(daysInMonthCount, Number(today.slice(8, 10)))
      : daysInMonthCount;
  let day: number;
  if (key === "Home") day = 1;
  else if (key === "End") day = last;
  else if (key in delta) day = Number(dayKey.slice(8, 10)) + delta[key]!;
  else return null;
  day = Math.max(1, Math.min(last, day));
  return dayKey.slice(0, 8) + String(day).padStart(2, "0");
}
