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

/** One cell inside a month block, with explicit grid placement. */
export interface MonthCell {
  day: LocalDay;
  row: number; // 1..7
  col: number; // 1..cols
  count: number;
  level: number;
  isPast: boolean; // day is on or before today
}

/** One month block of the monthly heatmap grid. */
export interface MonthBlock {
  year: number;
  month: number; // 1..12
  offset: number; // leading empty cells before day 1 (0..6)
  cols: number; // number of columns spanned (1..7)
  cells: MonthCell[];
}

/**
 * Slice the 52-week heatmap into 12 calendar month blocks ending in today's
 * month, oldest first. Reuses the existing per-day counting (activityHeatmap
 * output) — no duplication of the counting logic. Pure: today/weekStartsOn
 * are passed in.
 */
export function monthBlocks(
  heatmap: ActivityCell[],
  today: LocalDay,
  weekStartsOn: number,
): MonthBlock[] {
  const byDay = new Map<LocalDay, ActivityCell>();
  for (const cell of heatmap) byDay.set(cell.day, cell);

  const blocks: MonthBlock[] = [];
  // Build oldest-first: start 11 months before today's month.
  let cursor = addMonths(startOfMonth(today), -11);
  for (let i = 0; i < 12; i++) {
    const firstDay = cursor;
    const year = Number(firstDay.slice(0, 4));
    const monthNum = Number(firstDay.slice(5, 7));
    const weekdayIndexOfFirst = weekdayOf(firstDay);
    const offset = (weekdayIndexOfFirst - weekStartsOn + 7) % 7;
    const days = daysInMonth(firstDay);
    const cols = Math.ceil((offset + days) / 7);
    const cells: MonthCell[] = [];
    for (let d = 1; d <= days; d++) {
      const dayKey = addDays(firstDay, d - 1);
      const cell = byDay.get(dayKey);
      const count = cell?.count ?? 0;
      const level = cell?.level ?? 0;
      const row = ((offset + d - 1) % 7) + 1;
      const col = Math.floor((offset + d - 1) / 7) + 1;
      cells.push({ day: dayKey, row, col, count, level, isPast: dayKey <= today });
    }
    blocks.push({ year, month: monthNum, offset, cols, cells });
    cursor = addMonths(cursor, 1);
  }
  return blocks;
}
