import { addDays, startOfWeek, weekdayOf } from "./dates";
import type { Habit, HabitLog, HabitSchedule, LocalDay } from "./types";

/*
 * Pure habit-day math. Everything works on STORED LocalDay strings only:
 * a record's localDay is never recomputed (see AGENTS.md), so a later change
 * of timezone or dayStartHour never rewrites history.
 */

/** Gentle recovery: at most this many skips per calendar week are protected. */
export const SKIP_LIMIT_PER_WEEK = 2;

/**
 * Streak freeze (vacation mode): scheduled days on or before habit.pausedUntil
 * are frozen — they neither break nor extend a streak, never consume the
 * weekly skip budget, and leave the consistency denominator. A log written
 * during a freeze still shows in history (the log always wins for display).
 */
export function isFrozenOn(habit: Habit, day: LocalDay): boolean {
  return (
    habit.pausedUntil !== undefined &&
    day <= habit.pausedUntil &&
    (habit.pausedFrom === undefined || day >= habit.pausedFrom)
  );
}

export type DayKind = "done" | "skipped" | "missed" | "upcoming" | "off" | "frozen";

export function isScheduledOn(schedule: HabitSchedule, day: LocalDay): boolean {
  if (schedule.type === "daily") return true;
  return schedule.days.includes(weekdayOf(day));
}

/** Latest live log per localDay (one log per habit+day is the store invariant). */
export function logsByDay(logs: HabitLog[]): Map<LocalDay, HabitLog> {
  const by = new Map<LocalDay, HabitLog>();
  for (const log of logs) {
    if (log.deletedAt) continue;
    const prev = by.get(log.localDay);
    if (!prev || log.updatedAt > prev.updatedAt) by.set(log.localDay, log);
  }
  return by;
}

/** Skips in the same week (per settings.weekStartsOn), up to and including the given day. */
function skipsUpTo(day: LocalDay, by: Map<LocalDay, HabitLog>, weekStartsOn: number): number {
  let n = 0;
  for (let d = startOfWeek(day, weekStartsOn); d <= day; d = addDays(d, 1)) {
    if (by.get(d)?.status === "skipped") n++;
  }
  return n;
}

/** Heatmap / history cell kind. A log always shows, even on an unscheduled day. */
export function dayKind(
  schedule: HabitSchedule,
  by: Map<LocalDay, HabitLog>,
  day: LocalDay,
  today: LocalDay,
  habit?: Habit,
): DayKind {
  const status = by.get(day)?.status;
  if (status === "done" || status === "skipped") return status;
  if (habit && isFrozenOn(habit, day)) return "frozen";
  if (!isScheduledOn(schedule, day)) return "off";
  return day < today ? "missed" : "upcoming";
}

export interface StreakInfo {
  current: number;
  best: number;
}

/**
 * Streak rules:
 * - a streak counts consecutive SCHEDULED days that are done;
 * - a skipped day neither breaks nor extends it (protected skip);
 * - gentle recovery: at most SKIP_LIMIT_PER_WEEK (2) skips per week
 *   (week per settings.weekStartsOn) are protected — a 3rd skip in the
 *   same week breaks the streak;
 * - unscheduled days never break or extend;
 * - a missed scheduled day (no log) breaks;
 * - today never breaks the streak until the day has ended.
 */
export function habitStreaks(
  habit: Habit,
  logs: HabitLog[],
  today: LocalDay,
  weekStartsOn: number,
): StreakInfo {
  const by = logsByDay(logs);
  if (by.size === 0) return { current: 0, best: 0 };
  let earliest = today;
  for (const day of by.keys()) if (day < earliest) earliest = day;

  // current: walk backwards from today until something breaks.
  let current = 0;
  for (let d = today; d >= earliest; d = addDays(d, -1)) {
    if (!isScheduledOn(habit.schedule, d)) continue;
    const status = by.get(d)?.status;
    if (status === "done") {
      current++;
      continue;
    }
    if (status === "skipped") {
      if (isFrozenOn(habit, d)) continue; // freeze never consumes the skip budget
      if (skipsUpTo(d, by, weekStartsOn) > SKIP_LIMIT_PER_WEEK) break; // 3rd skip in the week
      continue; // protected skip: neither breaks nor extends
    }
    if (isFrozenOn(habit, d)) continue; // frozen day: protected without a log
    if (d === today) continue; // the day has not ended yet
    break; // missed scheduled day
  }

  // best: forward scan over the whole logged history.
  let best = 0;
  let run = 0;
  for (let d = earliest; d <= today; d = addDays(d, 1)) {
    if (!isScheduledOn(habit.schedule, d)) continue;
    const status = by.get(d)?.status;
    if (status === "done") {
      run++;
      if (run > best) best = run;
      continue;
    }
    if (status === "skipped") {
      if (isFrozenOn(habit, d)) continue;
      if (skipsUpTo(d, by, weekStartsOn) > SKIP_LIMIT_PER_WEEK) run = 0; // 3rd skip in the week
      continue; // protected skip keeps the run open without extending it
    }
    if (isFrozenOn(habit, d)) continue; // frozen day keeps the run open
    if (d === today) continue; // today may still be done — do not reset the run
    run = 0; // missed scheduled day
  }
  return { current, best };
}

/**
 * Consistency over the last 30 days (today included):
 *   consistency = done / (scheduled - skipped)
 * Scheduled days with a skipped log are excluded from the denominator, so a
 * skip neither rewards nor punishes the score; unscheduled days never count.
 * Returns null when nothing was scheduled in the window.
 */
export function consistency30(habit: Habit, logs: HabitLog[], today: LocalDay): number | null {
  const by = logsByDay(logs);
  let done = 0;
  let scheduled = 0;
  for (let i = 0; i < 30; i++) {
    const d = addDays(today, -i);
    if (!isScheduledOn(habit.schedule, d)) continue;
    if (isFrozenOn(habit, d)) continue; // rest days leave the denominator entirely
    const status = by.get(d)?.status;
    if (status === "skipped") continue;
    scheduled++;
    if (status === "done") done++;
  }
  return scheduled === 0 ? null : done / scheduled;
}
