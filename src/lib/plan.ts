import type { Locale } from "./i18n";
import { isScheduledOn } from "./streaks";
import type { Habit, HabitLog, LocalDay, Priority, Task } from "./types";

/*
 * Pure daily-plan engine behind the /plan board. All day math uses STORED
 * localDay strings â€” a record's day is never recomputed from a timestamp.
 */

export interface PlanInput {
  today: LocalDay;
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  focusTargetMinutes: number;
  dayStartHour: number;
  /** Minutes from midnight the day plan starts at. Default 09:00. */
  startMinute?: number;
  /** Minutes from midnight the day plan ends at. Default 22:00. */
  endOfDayMinute?: number;
}

export type PlanBlockKind = "task" | "habit" | "focus";

export interface PlanBlock {
  id: string;
  kind: PlanBlockKind;
  title: string;
  minutes: number;
  startMinute: number;
  priority: Priority | undefined;
  done: boolean;
  sourceId: string;
}

export interface DayPlan {
  blocks: PlanBlock[];
  totalMinutes: number;
  scheduledMinutes: number;
  overflowTasks: string[];
  startMinute: number;
  endMinute: number;
}

const PRIORITY_MINUTES: Record<Priority, number> = { high: 45, medium: 25, low: 15 };
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const HABIT_MINUTES = 10;
const FOCUS_GAP_MINUTES = 15;

function taskMinutes(t: Task): number {
  const undone = t.subtasks.filter((s) => !s.done).length;
  return PRIORITY_MINUTES[t.priority] + undone * 10;
}

export function buildDayPlan(input: PlanInput): DayPlan {
  const startMinute = input.startMinute ?? 9 * 60;
  const endOfDayMinute = input.endOfDayMinute ?? 22 * 60;
  const today = input.today;

  const open = input.tasks.filter((t) => !t.deletedAt && t.status !== "done");
  const candidates = open.filter((t) => t.dueDate !== undefined && t.dueDate <= today);

  const doneToday = new Set(
    input.habitLogs
      .filter((l) => !l.deletedAt && l.localDay === today && l.status === "done")
      .map((l) => l.habitId),
  );
  const habits = input.habits
    .filter((h) => !h.deletedAt && !h.archived && isScheduledOn(h.schedule, today))
    .map((h) => ({ habit: h, done: doneToday.has(h.id) }));

  const taskBlocks = candidates
    .map((t) => ({ task: t, minutes: taskMinutes(t) }))
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority] ||
        (a.task.dueDate ?? "").localeCompare(b.task.dueDate ?? "") ||
        a.task.title.localeCompare(b.task.title),
    );
  const habitBlocks = habits
    .map(({ habit, done }) => ({ habit, done }))
    .sort((a, b) => Number(a.done) - Number(b.done) || a.habit.name.localeCompare(b.habit.name));

  const blocks: PlanBlock[] = [];
  const overflowTasks: string[] = [];
  let cursor = startMinute;
  let totalMinutes = 0;
  let scheduledMinutes = 0;

  /*
   * Time-blocking: a task may carry blockStart (minutes from midnight, pinned
   * by dragging on /plan). Pinned tasks are placed first at their requested
   * time (or the next free slot at/after it); everything else flows into the
   * gaps in priority order. Occupied intervals never overlap.
   */
  const occupied: { start: number; end: number }[] = [];
  const fits = (start: number, minutes: number): boolean =>
    start >= startMinute &&
    start + minutes <= endOfDayMinute &&
    occupied.every((o) => start + minutes <= o.start || start >= o.end);
  const nextFree = (from: number, minutes: number): number | null => {
    const candidates = [from, ...occupied.map((o) => o.end)].sort((a, b) => a - b);
    for (const c of candidates) if (c >= from && fits(c, minutes)) return c;
    return null;
  };
  const placeAt = (b: Omit<PlanBlock, "startMinute">, start: number): void => {
    blocks.push({ ...b, startMinute: start });
    occupied.push({ start, end: start + b.minutes });
    cursor = Math.max(cursor, start + b.minutes);
    totalMinutes += b.minutes;
  };
  const place = (b: Omit<PlanBlock, "startMinute">, gapBefore = 0): boolean => {
    const start = nextFree(cursor + gapBefore, b.minutes);
    if (start === null) return false;
    placeAt(b, start);
    return true;
  };

  const pinned = taskBlocks.filter(({ task }) => task.blockStart !== undefined);
  const flowing = taskBlocks.filter(({ task }) => task.blockStart === undefined);
  pinned.sort((a, b) => (a.task.blockStart ?? 0) - (b.task.blockStart ?? 0));
  for (const { task, minutes } of pinned) {
    const desired = Math.min(Math.max(task.blockStart!, startMinute), endOfDayMinute - minutes);
    const start = fits(desired, minutes) ? desired : nextFree(desired, minutes);
    const block = {
      id: `task:${task.id}`,
      kind: "task" as const,
      title: task.title,
      minutes,
      priority: task.priority,
      done: false,
      sourceId: task.id,
    };
    if (start === null) overflowTasks.push(task.title);
    else placeAt(block, start);
  }
  for (const { task, minutes } of flowing) {
    const placed = place({
      id: `task:${task.id}`,
      kind: "task",
      title: task.title,
      minutes,
      priority: task.priority,
      done: false,
      sourceId: task.id,
    });
    if (!placed) overflowTasks.push(task.title);
  }
  for (const { habit, done } of habitBlocks) {
    place({
      id: `habit:${habit.id}`,
      kind: "habit",
      title: habit.name,
      minutes: HABIT_MINUTES,
      priority: undefined,
      done,
      sourceId: habit.id,
    });
  }
  if (input.focusTargetMinutes > 0) {
    const placed = place(
      {
        id: "focus:0",
        kind: "focus",
        title: "",
        minutes: input.focusTargetMinutes,
        priority: undefined,
        done: false,
        sourceId: "",
      },
      FOCUS_GAP_MINUTES,
    );
    if (placed) scheduledMinutes = input.focusTargetMinutes;
  }
  blocks.sort((a, b) => a.startMinute - b.startMinute);

  return {
    blocks,
    totalMinutes,
    scheduledMinutes,
    overflowTasks,
    startMinute: blocks.length ? blocks[0]!.startMinute : startMinute,
    endMinute: cursor,
  };
}

/** Localized wall-clock label for minutes from midnight. */
export function formatClock(locale: Locale, minutes: number, hour12 = false): string {
  const date = new Date(Date.UTC(2023, 0, 1, Math.floor(minutes / 60), minutes % 60));
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12,
    timeZone: "UTC",
  }).format(date);
}

export interface PlacedPlanBlock {
  block: PlanBlock;
  lane: number;
  /** Columns in this block's overlap cluster (1 when nothing overlaps). */
  lanes: number;
  top: number;
  height: number;
}

export interface DayLayout {
  blocks: PlacedPlanBlock[];
  height: number;
  laneCount: number;
}

export interface DayLayoutOptions {
  startMinute?: number;
  endMinute?: number;
  hourPx?: number;
  minBlockPx?: number;
}

/*
 * Display geometry for the /plan timeline. Positions come from the stored
 * start and duration only; short blocks keep their true top and grow to a
 * readable minimum height. Blocks whose rendered boxes collide (including
 * that growth) get side-by-side lanes so nothing is hidden.
 */
export function layoutDayPlan(blocks: PlanBlock[], opts: DayLayoutOptions = {}): DayLayout {
  const startMinute = opts.startMinute ?? 9 * 60;
  const endMinute = opts.endMinute ?? 22 * 60;
  const hourPx = opts.hourPx ?? 64;
  const minBlockPx = opts.minBlockPx ?? 28;

  const sorted = [...blocks].sort(
    (a, b) => a.startMinute - b.startMinute || a.id.localeCompare(b.id),
  );
  const placed: PlacedPlanBlock[] = [];
  let cluster: { block: PlanBlock; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const topOf = (b: PlanBlock) => ((b.startMinute - startMinute) / 60) * hourPx;
  const heightOf = (b: PlanBlock) => Math.max((b.minutes / 60) * hourPx, minBlockPx);
  const bottomOf = (b: PlanBlock) => topOf(b) + heightOf(b);

  const flush = () => {
    for (const { block, lane } of cluster) {
      placed.push({
        block,
        lane,
        lanes: laneEnds.length,
        top: topOf(block),
        height: heightOf(block),
      });
    }
    cluster = [];
    laneEnds = [];
  };

  for (const block of sorted) {
    // Lanes compare RENDERED intervals: short blocks grow to minBlockPx, so
    // back-to-back 15-minute events would otherwise overlap on screen.
    if (topOf(block) >= clusterEnd) flush();
    clusterEnd = Math.max(clusterEnd, bottomOf(block));
    let lane = laneEnds.findIndex((end) => end <= topOf(block));
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = bottomOf(block);
    cluster.push({ block, lane });
  }
  flush();

  return {
    blocks: placed,
    height: ((endMinute - startMinute) / 60) * hourPx,
    laneCount: placed.reduce((max, b) => Math.max(max, b.lanes), 0),
  };
}
