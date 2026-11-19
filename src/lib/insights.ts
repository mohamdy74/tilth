import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  isValidTimestamp,
  startOfMonth,
  startOfWeek,
  toLocalDay,
  weekdayOf,
} from "./dates";
import { actualMinutes } from "./focusTime";
import { isScheduledOn, logsByDay } from "./streaks";
import type { FocusSession, Habit, HabitLog, LocalDay, Task, XpLedgerEntry } from "./types";

/*
 * Pure insights engine: daily series + honest observations.
 * - series work on STORED localDays / toLocalDay(completedAt) only, never
 *   recomputing history;
 * - habit consistency follows the app convention (consistency30):
 *   done / (scheduled - skipped), skipped days leave the denominator;
 * - focus minutes are ACTUAL wall-time minutes of completed work
 *   sessions, grouped by the session's stored localDay;
 * - observations are claims with data floors (no claim below the floor),
 *   each carrying its sample size so the page can state the basis.
 */

/** Observation window: the last 28 days, today included. */
export const ACTIVE_WINDOW_DAYS = 28;

/** Minimum days with activity before any observation is allowed. */
export const MIN_ACTIVE_DAYS = 14;

const MIN_TASKS_FOR_TIME_OF_DAY = 10;
const MIN_FOCUS_SESSIONS = 6;
const MIN_FOCUS_WEEKDAYS = 3;
const MIN_SKIPS_FOR_HABIT = 3;
const TOP_BUCKET_MIN_SHARE = 0.4;

export interface DayPoint {
  day: LocalDay;
  value: number | null;
}

export interface HabitDayPoint extends DayPoint {
  scheduled: number;
  done: number;
  skipped: number;
}

export type ObservationId = "taskTimeOfDay" | "focusWeekday" | "skippedHabit";

export interface Observation {
  id: ObservationId;
  params: Record<string, string>;
  /** Sample size behind the claim (for the basis line). */
  events: number;
  activeDays: number;
}

export interface InsightsReport {
  activeDays: number;
  hasAnyData: boolean;
  observations: Observation[];
}

/** The last `days` days ending today, oldest first. */
export function windowDays(today: LocalDay, days: number): LocalDay[] {
  const out: LocalDay[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}

/** Done tasks per day, grouped by the completion day (dayStartHour honored). */
export function taskCompletionsByDay(
  tasks: Task[],
  opts: { today: LocalDay; days: number; dayStartHour: number; timeZone: string },
): DayPoint[] {
  const by = new Map<LocalDay, number>();
  for (const t of tasks) {
    if (
      t.deletedAt ||
      t.status !== "done" ||
      t.completedAt === undefined ||
      !isValidTimestamp(t.completedAt)
    )
      continue;
    const day = toLocalDay(new Date(t.completedAt), opts.dayStartHour, opts.timeZone);
    by.set(day, (by.get(day) ?? 0) + 1);
  }
  return windowDays(opts.today, opts.days).map((day) => ({ day, value: by.get(day) ?? 0 }));
}

/**
 * Per-day habit consistency: done / (scheduled - skipped) in percent.
 * Skipped days leave the denominator (the consistency30 convention);
 * value is null when nothing was scheduled (or everything was skipped).
 */
export function habitConsistencyByDay(
  habits: Habit[],
  logs: HabitLog[],
  opts: { today: LocalDay; days: number },
): HabitDayPoint[] {
  const live = habits.filter((h) => !h.deletedAt && !h.archived);
  const byHabit = new Map<string, Map<LocalDay, HabitLog>>();
  for (const h of live) {
    byHabit.set(h.id, logsByDay(logs.filter((l) => l.habitId === h.id)));
  }
  return windowDays(opts.today, opts.days).map((day) => {
    let scheduled = 0;
    let done = 0;
    let skipped = 0;
    for (const h of live) {
      if (!isScheduledOn(h.schedule, day)) continue;
      scheduled++;
      const status = byHabit.get(h.id)?.get(day)?.status;
      if (status === "done") done++;
      else if (status === "skipped") skipped++;
    }
    const denom = scheduled - skipped;
    return {
      day,
      scheduled,
      done,
      skipped,
      value: denom > 0 ? Math.round((100 * done) / denom) : null,
    };
  });
}

/** Actual minutes of completed work sessions per stored localDay. */
export function focusMinutesByDay(
  sessions: FocusSession[],
  opts: { today: LocalDay; days: number },
): DayPoint[] {
  const by = new Map<LocalDay, number>();
  for (const s of sessions) {
    if (s.deletedAt || !s.completed || s.mode === "break" || s.endedAt === undefined) continue;
    const m = actualMinutes(s);
    if (m === null || m <= 0) continue;
    by.set(s.localDay, (by.get(s.localDay) ?? 0) + m);
  }
  return windowDays(opts.today, opts.days).map((day) => ({ day, value: by.get(day) ?? 0 }));
}

/** Wall-clock hour (0..23) of an ISO timestamp in the given timezone. */
function hourInTz(iso: string, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(
      new Date(iso),
    ),
  );
}

/**
 * The observations engine. A claim only appears when the data clears its
 * floor; the basis (events + active days) travels with every claim.
 */
export function insightsReport(input: {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  focusSessions: FocusSession[];
  xpLedger: XpLedgerEntry[];
  today: LocalDay;
  timeZone: string;
  dayStartHour: number;
}): InsightsReport {
  const window = windowDays(input.today, ACTIVE_WINDOW_DAYS);
  const inWindow = new Set<LocalDay>(window);
  const doneTasks = input.tasks.filter(
    (t) =>
      !t.deletedAt &&
      t.status === "done" &&
      t.completedAt !== undefined &&
      isValidTimestamp(t.completedAt),
  );
  const workSessions = input.focusSessions.filter(
    (s) => !s.deletedAt && s.completed && s.mode !== "break" && (actualMinutes(s) ?? 0) > 0,
  );

  const active = new Set<LocalDay>();
  for (const e of input.xpLedger) {
    if (!e.deletedAt && inWindow.has(e.localDay)) active.add(e.localDay);
  }
  for (const t of doneTasks) {
    const d = toLocalDay(new Date(t.completedAt as string), input.dayStartHour, input.timeZone);
    if (inWindow.has(d)) active.add(d);
  }
  for (const l of input.habitLogs) {
    if (!l.deletedAt && inWindow.has(l.localDay)) active.add(l.localDay);
  }
  for (const s of input.focusSessions) {
    if (!s.deletedAt && inWindow.has(s.localDay)) active.add(s.localDay);
  }
  const activeDays = active.size;
  const hasAnyData =
    input.tasks.some((t) => !t.deletedAt) ||
    input.habits.some((h) => !h.deletedAt) ||
    input.habitLogs.some((l) => !l.deletedAt) ||
    input.focusSessions.some((s) => !s.deletedAt) ||
    input.xpLedger.some((e) => !e.deletedAt);

  const observations: Observation[] = [];
  if (activeDays < MIN_ACTIVE_DAYS) return { activeDays, hasAnyData, observations };

  // Time of day: the top completion bucket must clearly lead.
  const completions = doneTasks
    .map((t) => ({
      day: toLocalDay(new Date(t.completedAt as string), input.dayStartHour, input.timeZone),
      hour: hourInTz(t.completedAt as string, input.timeZone),
    }))
    .filter((c) => inWindow.has(c.day));
  if (completions.length >= MIN_TASKS_FOR_TIME_OF_DAY) {
    const buckets: { bucket: string; n: number }[] = [
      { bucket: "morning", n: completions.filter((c) => c.hour < 12).length },
      { bucket: "afternoon", n: completions.filter((c) => c.hour >= 12 && c.hour < 17).length },
      { bucket: "evening", n: completions.filter((c) => c.hour >= 17).length },
    ];
    buckets.sort((a, b) => b.n - a.n);
    const top = buckets[0];
    const second = buckets[1];
    if (top && second) {
      const share = top.n / completions.length;
      if (share >= TOP_BUCKET_MIN_SHARE && top.n > second.n) {
        observations.push({
          id: "taskTimeOfDay",
          params: { bucket: top.bucket, pct: String(Math.round(share * 100)) },
          events: completions.length,
          activeDays,
        });
      }
    }
  }

  // Best focus weekday: total actual minutes per weekday of the window.
  const windowSessions = workSessions.filter((s) => inWindow.has(s.localDay));
  if (windowSessions.length >= MIN_FOCUS_SESSIONS) {
    const sums = new Map<number, number>();
    for (const s of windowSessions) {
      const wd = weekdayOf(s.localDay);
      sums.set(wd, (sums.get(wd) ?? 0) + (actualMinutes(s) ?? 0));
    }
    if (sums.size >= MIN_FOCUS_WEEKDAYS) {
      let best = -1;
      let bestTotal = -1;
      for (let wd = 0; wd < 7; wd++) {
        const total = sums.get(wd) ?? 0;
        if (total > bestTotal) {
          bestTotal = total;
          best = wd;
        }
      }
      if (best >= 0) {
        observations.push({
          id: "focusWeekday",
          params: { weekday: String(best) },
          events: windowSessions.length,
          activeDays,
        });
      }
    }
  }

  // Most-skipped live habit in the window.
  const liveHabits = input.habits.filter((h) => !h.deletedAt && !h.archived);
  const skips = new Map<string, number>();
  for (const l of input.habitLogs) {
    if (l.deletedAt || l.status !== "skipped" || !inWindow.has(l.localDay)) continue;
    if (!liveHabits.some((h) => h.id === l.habitId)) continue;
    skips.set(l.habitId, (skips.get(l.habitId) ?? 0) + 1);
  }
  let topHabit: Habit | null = null;
  let topSkips = 0;
  for (const h of liveHabits) {
    const c = skips.get(h.id) ?? 0;
    if (c > topSkips) {
      topSkips = c;
      topHabit = h;
    }
  }
  if (topHabit && topSkips >= MIN_SKIPS_FOR_HABIT) {
    observations.push({
      id: "skippedHabit",
      params: { habit: topHabit.name },
      events: topSkips,
      activeDays,
    });
  }

  return { activeDays, hasAnyData, observations };
}

/* ---------------- weekly review ---------------- */

export interface WeekMetrics {
  tasksDone: number;
  focusMinutes: number;
  habitDone: number;
  habitScheduled: number;
  xp: number;
}

export interface WeeklyReview {
  weekStart: LocalDay;
  weekEnd: LocalDay;
  current: WeekMetrics;
  previous: WeekMetrics;
  /** Open tasks due on or before the week end — candidates to carry forward. */
  carryOver: {
    id: string;
    title: string;
    dueDate: LocalDay | undefined;
    priority: Task["priority"];
  }[];
}

function weekMetrics(input: {
  tasks: Task[];
  habitLogs: HabitLog[];
  habits: Habit[];
  focusSessions: FocusSession[];
  xpLedger: XpLedgerEntry[];
  from: LocalDay;
  to: LocalDay;
  dayStartHour: number;
  timeZone: string;
}): WeekMetrics {
  const inRange = (d: LocalDay) => d >= input.from && d <= input.to;
  const tasksDone = input.tasks.filter(
    (t) =>
      !t.deletedAt &&
      t.status === "done" &&
      t.completedAt !== undefined &&
      isValidTimestamp(t.completedAt) &&
      inRange(toLocalDay(new Date(t.completedAt), input.dayStartHour, input.timeZone)),
  ).length;
  const focusMinutes = input.focusSessions
    .filter((s) => !s.deletedAt && s.completed && s.mode !== "break" && inRange(s.localDay))
    .reduce((sum, s) => sum + s.plannedMinutes, 0);
  let habitDone = 0;
  let habitScheduled = 0;
  const liveHabits = input.habits.filter((h) => !h.deletedAt && !h.archived);
  for (let d = input.from; d <= input.to; d = addDays(d, 1)) {
    for (const h of liveHabits) {
      if (!isScheduledOn(h.schedule, d)) continue;
      habitScheduled++;
      const log = input.habitLogs.find(
        (l) => !l.deletedAt && l.habitId === h.id && l.localDay === d && l.status === "done",
      );
      if (log) habitDone++;
    }
  }
  const xp = input.xpLedger
    .filter((e) => !e.deletedAt && inRange(e.localDay))
    .reduce((sum, e) => sum + Math.max(0, e.xp), 0);
  return { tasksDone, focusMinutes, habitDone, habitScheduled, xp };
}

/**
 * The weekly review ritual: this week vs last week on stored days, plus the
 * open tasks that did not get done in time (carry-over candidates).
 */
export function weeklyReview(input: {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  focusSessions: FocusSession[];
  xpLedger: XpLedgerEntry[];
  today: LocalDay;
  weekStartsOn: number;
  dayStartHour: number;
  timeZone: string;
}): WeeklyReview {
  const weekStart = startOfWeek(input.today, input.weekStartsOn);
  const weekEnd = endOfWeek(input.today, input.weekStartsOn);
  const prevStart = addDays(weekStart, -7);
  const prevEnd = addDays(weekStart, -1);
  const base = {
    tasks: input.tasks,
    habits: input.habits,
    habitLogs: input.habitLogs,
    focusSessions: input.focusSessions,
    xpLedger: input.xpLedger,
    dayStartHour: input.dayStartHour,
    timeZone: input.timeZone,
  };
  const carryOver = input.tasks
    .filter(
      (t) => !t.deletedAt && t.status !== "done" && t.dueDate !== undefined && t.dueDate <= weekEnd,
    )
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, priority: t.priority }));
  return {
    weekStart,
    weekEnd,
    current: weekMetrics({ ...base, from: weekStart, to: weekEnd }),
    previous: weekMetrics({ ...base, from: prevStart, to: prevEnd }),
    carryOver,
  };
}

/* ---------------- weekday focus aggregate ---------------- */

export interface WeekdayFocus {
  weekday: number; // 0=Sun..6=Sat
  sessions: number;
  avgMinutes: number;
}

/** Average completed work minutes per weekday over the window (stored days). */
export function weekdayFocus(
  sessions: FocusSession[],
  today: LocalDay,
  days = ACTIVE_WINDOW_DAYS,
): WeekdayFocus[] {
  const from = addDays(today, -(days - 1));
  const acc = Array.from({ length: 7 }, (_, weekday) => ({ weekday, sessions: 0, minutes: 0 }));
  for (const s of sessions) {
    if (s.deletedAt || !s.completed || s.mode === "break") continue;
    if (s.localDay < from || s.localDay > today) continue;
    const a = acc[weekdayOf(s.localDay)]!;
    a.sessions++;
    a.minutes += s.plannedMinutes;
  }
  return acc.map((a) => ({
    weekday: a.weekday,
    sessions: a.sessions,
    avgMinutes: a.sessions === 0 ? 0 : Math.round(a.minutes / a.sessions),
  }));
}

/* ---------------- month over month ---------------- */

export interface MonthCompare {
  thisMinutes: number;
  lastMinutes: number;
  deltaPct: number;
  thisActiveDays: number;
  lastActiveDays: number;
}

const MONTH_MIN_ACTIVE_DAYS = 14;

/**
 * Focus minutes this calendar month vs the previous one. Returns null unless
 * BOTH months carry at least MONTH_MIN_ACTIVE_DAYS active days — the same
 * honesty floor as the observations engine.
 */
export function monthOverMonth(sessions: FocusSession[], today: LocalDay): MonthCompare | null {
  const thisStart = startOfMonth(today);
  const thisEnd = endOfMonth(today);
  const lastStart = startOfMonth(addMonths(today, -1));
  const lastEnd = endOfMonth(addMonths(today, -1));
  const sum = (from: LocalDay, to: LocalDay) => {
    let minutes = 0;
    const days = new Set<LocalDay>();
    for (const s of sessions) {
      if (s.deletedAt || !s.completed || s.mode === "break") continue;
      if (s.localDay < from || s.localDay > to) continue;
      minutes += s.plannedMinutes;
      days.add(s.localDay);
    }
    return { minutes, active: days.size };
  };
  const a = sum(thisStart, thisEnd);
  const b = sum(lastStart, lastEnd);
  if (a.active < MONTH_MIN_ACTIVE_DAYS || b.active < MONTH_MIN_ACTIVE_DAYS) return null;
  const deltaPct = b.minutes === 0 ? 0 : Math.round(((a.minutes - b.minutes) / b.minutes) * 100);
  return {
    thisMinutes: a.minutes,
    lastMinutes: b.minutes,
    deltaPct,
    thisActiveDays: a.active,
    lastActiveDays: b.active,
  };
}

/* ---------------- time allocation ---------------- */

export interface DayAllocation {
  day: LocalDay;
  focusMinutes: number;
  tasksDone: number;
}

/** Time allocation per day: planned focus minutes vs completed task count.
 * Focus minutes are planned (not wall-clock elapsed); task count is done
 * tasks grouped by completion day. Honest about what is and isn't measured.
 */
export function timeAllocation(
  tasks: Task[],
  sessions: FocusSession[],
  opts: { today: LocalDay; days: number },
): DayAllocation[] {
  const focusByDay = new Map<LocalDay, number>();
  for (const s of sessions) {
    if (s.deletedAt || !s.completed || s.mode === "break") continue;
    const m = s.plannedMinutes;
    focusByDay.set(s.localDay, (focusByDay.get(s.localDay) ?? 0) + m);
  }
  const tasksByDay = new Map<LocalDay, number>();
  for (const t of tasks) {
    if (
      t.deletedAt ||
      t.status !== "done" ||
      t.completedAt === undefined ||
      !isValidTimestamp(t.completedAt)
    )
      continue;
    tasksByDay.set(
      t.completedAt.slice(0, 10),
      (tasksByDay.get(t.completedAt.slice(0, 10)) ?? 0) + 1,
    );
  }
  return windowDays(opts.today, opts.days).map((day) => ({
    day,
    focusMinutes: focusByDay.get(day) ?? 0,
    tasksDone: tasksByDay.get(day) ?? 0,
  }));
}
