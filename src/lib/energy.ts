import { addDays, toLocalDay } from "./dates";
import type { LocalDay, Task } from "./types";

export interface EnergySuggestion {
  taskId: string;
  /** Suggested start of day, minutes from midnight. */
  startMinute: number;
  label: string;
}

/** The clock hour (0..23) in the user's zone when the user most often
 * completes tasks, over the last `days` stored days. Undefined when there is
 * no signal — callers should fall back to the default block placement. */
export function topCompletionHour(
  tasks: Task[],
  opts: { today: LocalDay; days: number; dayStartHour: number; timeZone: string },
): number | undefined {
  const cutoff = addDays(opts.today, -(opts.days - 1));
  const hourCounts = new Map<number, number>();
  for (const t of tasks) {
    if (t.deletedAt || t.status !== "done" || t.completedAt === undefined) continue;
    const day = toLocalDay(new Date(t.completedAt), opts.dayStartHour, opts.timeZone);
    if (day < cutoff || day > opts.today) continue;
    const h = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone: opts.timeZone,
      }).format(new Date(t.completedAt)),
    );
    hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
  }
  let best: number | undefined;
  let bestN = 0;
  for (const [h, n] of hourCounts) {
    if (n > bestN) {
      bestN = n;
      best = h;
    }
  }
  return best;
}

function clockLabel(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return h + ":" + (m < 10 ? "0" + m : m);
}

/** Suggest a start block for an unpinned open task, anchored to the hour the
 * user historically finishes most work. Clamped to a 09:00–18:00 work window.
 * Pure — returns a draft the user must approve before anything is pinned. */
export function suggestTaskStart(
  task: Task,
  tasks: Task[],
  opts: { today: LocalDay; days: number; dayStartHour: number; timeZone: string },
): EnergySuggestion | undefined {
  if (task.blockStart !== undefined || task.status === "done" || task.deletedAt) return undefined;
  const hour = topCompletionHour(tasks, opts);
  if (hour === undefined) return undefined;
  let minute = hour * 60;
  minute = Math.min(18 * 60, Math.max(9 * 60, minute));
  return { taskId: task.id, startMinute: minute, label: clockLabel(minute) };
}
