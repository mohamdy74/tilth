import { windowDays } from "./insights";
import type { FocusSession, LocalDay } from "./types";

export interface DayDistractions {
  day: LocalDay;
  count: number;
}

/** Distraction taps per stored localDay over the last `days` days (default 7).
 * Pure. Used for the weekly distraction review surface. */
export function distractionsByDay(
  sessions: FocusSession[],
  today: LocalDay,
  days = 7,
): DayDistractions[] {
  const by = new Map<LocalDay, number>();
  for (const s of sessions) {
    if (s.deletedAt || !s.completed) continue;
    by.set(s.localDay, (by.get(s.localDay) ?? 0) + s.distractions.length);
  }
  return windowDays(today, days).map((day) => ({ day, count: by.get(day) ?? 0 }));
}
