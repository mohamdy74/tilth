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

  const place = (b: Omit<PlanBlock, "startMinute">, gapBefore = 0): boolean => {
    if (cursor + gapBefore + b.minutes > endOfDayMinute) return false;
    cursor += gapBefore;
    blocks.push({ ...b, startMinute: cursor });
    cursor += b.minutes;
    totalMinutes += b.minutes;
    return true;
  };

  for (const { task, minutes } of taskBlocks) {
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

  return {
    blocks,
    totalMinutes,
    scheduledMinutes,
    overflowTasks,
    startMinute: blocks.length ? blocks[0]!.startMinute : startMinute,
    endMinute: cursor,
  };
}
