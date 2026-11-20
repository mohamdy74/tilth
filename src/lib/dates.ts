import type { LocalDay } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/*
 * Intl formatters are expensive to construct and were previously rebuilt on
 * every toLocalDay() call — measurable on the dashboard, where the evening
 * digest resolves a local day for every completed task on each render.
 * Time zones are a tiny closed set per session, so cache by zone.
 */
const wallClockFormatters = new Map<string, Intl.DateTimeFormat>();
function wallClockFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = wallClockFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    });
    wallClockFormatters.set(timeZone, fmt);
  }
  return fmt;
}

function wallClock(date: Date, timeZone: string) {
  const parts = wallClockFormatter(timeZone).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour") };
}

/** Wall-clock day in `timeZone`; hours before `dayStartHour` belong to the previous day. */
export function toLocalDay(date: Date, dayStartHour = 0, timeZone = currentTimeZone()): LocalDay {
  const { y, m, d, h } = wallClock(date, timeZone);
  const day = `${y}-${pad(m)}-${pad(d)}`;
  return h < dayStartHour ? addDays(day, -1) : day;
}

export function currentTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Guards imported or legacy timestamps before date formatting or timezone conversion. */
export function isValidTimestamp(value: string): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;

  const [, yearPart, monthPart, dayPart, hourPart, minutePart, secondPart] = match;
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  const second = Number(secondPart);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59
  );
}

// LocalDay arithmetic is done on UTC dates so DST never shifts a calendar day.
function parse(day: LocalDay) {
  const [y = 1970, m = 1, d = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function format(dt: Date): LocalDay {
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function addDays(day: LocalDay, n: number): LocalDay {
  const dt = parse(day);
  dt.setUTCDate(dt.getUTCDate() + n);
  return format(dt);
}

export function addMonths(day: LocalDay, n: number): LocalDay {
  const dt = parse(day);
  const target = dt.getUTCDate();
  dt.setUTCDate(1);
  dt.setUTCMonth(dt.getUTCMonth() + n);
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(target, last));
  return format(dt);
}

/** 0=Sun..6=Sat */
export function weekdayOf(day: LocalDay): number {
  return parse(day).getUTCDay();
}

export function startOfWeek(day: LocalDay, weekStartsOn: number): LocalDay {
  const diff = (weekdayOf(day) - weekStartsOn + 7) % 7;
  return addDays(day, -diff);
}

export function endOfWeek(day: LocalDay, weekStartsOn: number): LocalDay {
  return addDays(startOfWeek(day, weekStartsOn), 6);
}

export function startOfMonth(day: LocalDay): LocalDay {
  return day.slice(0, 8) + "01";
}

export function endOfMonth(day: LocalDay): LocalDay {
  const dt = parse(day);
  return format(new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)));
}

/** Number of days in the month of `day`. */
export function daysInMonth(day: LocalDay): number {
  return Number(endOfMonth(day).slice(8, 10));
}

export function daysBetween(a: LocalDay, b: LocalDay): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

/** Default week start: Saturday for Arabic, Monday for English. */
export function defaultWeekStartsOn(language: "en" | "ar"): number {
  return language === "ar" ? 6 : 1;
}

/** Keeps imported or legacy week-start preferences inside the calendar range. */
export function normalizeWeekStartsOn(value: unknown, fallback: number): number {
  const safeFallback = Number.isInteger(fallback) && fallback >= 0 && fallback <= 6 ? fallback : 1;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6
    ? value
    : safeFallback;
}
