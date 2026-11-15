import { morningDigest, eveningDigest, type DigestState } from "./digest";
import type { DigestPrefs } from "./types";

/*
 * Turns digest preferences + data into the exact notification that should
 * fire "now" — or null when it is too early, disabled, or already sent today.
 * Extracted from AppShell so the shell does not subscribe to every collection
 * just to compose a notification, and so the behavior is unit-testable.
 */

/** The strings the composer needs (subset of the typed i18n dictionary). */
export interface DigestStrings {
  notif: { morningTitle: string; eveningTitle: string };
  dig: {
    tasksDue: string;
    overdue: string;
    habitsDue: string;
    quietDay: string;
    completedToday: string;
    focusToday: string;
    stillOpen: string;
    tomorrow: string;
  };
}

export interface DigestNotification {
  slot: "morning" | "evening";
  title: string;
  body: string;
}

/** "HH:MM" → minutes since midnight (tolerant of junk). */
export function slotMinutes(at: string): number {
  const [h = 0, m = 0] = at.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function composeDigest(
  prefs: DigestPrefs | undefined,
  state: DigestState,
  strings: DigestStrings,
): DigestNotification | null {
  if (!prefs?.enabled) return null;
  const minutes = state.hour * 60 + new Date().getMinutes();
  if (state.hour < 17) {
    if (minutes < slotMinutes(prefs.morningAt)) return null;
    const d = morningDigest(state);
    const parts = [strings.dig.tasksDue.replace("{n}", String(d.tasksDue))];
    if (d.overdue > 0) parts.push(strings.dig.overdue.replace("{n}", String(d.overdue)));
    parts.push(strings.dig.habitsDue.replace("{n}", String(d.habitsDue)));
    const quiet = d.tasksDue === 0 && d.overdue === 0 && d.habitsDue === 0;
    return {
      slot: "morning",
      title: strings.notif.morningTitle,
      body: quiet ? strings.dig.quietDay : parts.join(" · "),
    };
  }
  if (minutes < slotMinutes(prefs.eveningAt)) return null;
  const e = eveningDigest(state);
  const parts = [
    strings.dig.completedToday.replace("{n}", String(e.completedToday)),
    strings.dig.focusToday.replace("{n}", String(e.focusMinutes)),
  ];
  if (e.stillOpen > 0) parts.push(strings.dig.stillOpen.replace("{n}", String(e.stillOpen)));
  if (e.tomorrowOpen > 0) parts.push(strings.dig.tomorrow.replace("{n}", String(e.tomorrowOpen)));
  const quiet = e.completedToday === 0 && e.stillOpen === 0 && e.tomorrowOpen === 0;
  return {
    slot: "evening",
    title: strings.notif.eveningTitle,
    body: quiet ? strings.dig.quietDay : parts.join(" · "),
  };
}
