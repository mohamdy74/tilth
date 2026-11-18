import { parseQuickAdd } from "./quickAdd";
import type { LocalDay, Priority } from "./types";

/*
 * Smart capture: decide whether pasted text is a task, a note, a habit or a
 * focus session, then shape it. Pure — `today` is passed in. Task parsing
 * reuses parseQuickAdd. Explicit prefixes win over the length heuristic:
 *   note:/ملاحظة:   task:/مهمة:   habit:/عادة:   focus:/تركيز:/ركز
 */

export type CaptureKind = "task" | "note" | "habit" | "focus";

export interface CaptureResult {
  kind: CaptureKind;
  title: string;
  /** "" for tasks, habits and focus. */
  body: string;
  tags: string[];
  priority: Priority | undefined;
  dueDate: LocalDay | undefined;
  /** Planned minutes for kind "focus" (1..180); undefined otherwise. */
  minutes?: number | undefined;
}

const NOTE_PREFIX = /^(note|ملاحظة)\s*:\s*/i;
const TASK_PREFIX = /^(task|مهمة)\s*:\s*/i;
const HABIT_PREFIX = /^(habit|عادة)\s*:\s*/i;
const FOCUS_PREFIX = /^(focus|تركيز|ركز)\s*:?\s*/i;

/** Arabic-Indic digits -> ASCII, so "ركز ٥٠" parses like "focus 50". */
const asciiDigits = (s: string): string =>
  s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

export function isBareUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

export function captureFromText(input: string, today: LocalDay): CaptureResult {
  const empty: CaptureResult = {
    kind: "note",
    title: "",
    body: "",
    tags: [],
    priority: undefined,
    dueDate: undefined,
  };
  const raw = input.trim();
  if (!raw) return empty;

  let text = raw;
  let forced: CaptureKind | null = null;
  const noteM = raw.match(NOTE_PREFIX);
  const taskM = raw.match(TASK_PREFIX);
  const habitM = raw.match(HABIT_PREFIX);
  const focusM = raw.match(FOCUS_PREFIX);
  if (noteM) {
    forced = "note";
    text = raw.slice(noteM[0].length);
  } else if (taskM) {
    forced = "task";
    text = raw.slice(taskM[0].length);
  } else if (habitM) {
    forced = "habit";
    text = raw.slice(habitM[0].length);
  } else if (focusM) {
    forced = "focus";
    text = raw.slice(focusM[0].length);
  }
  text = text.trim();
  if (forced === "focus") {
    const m = asciiDigits(text).match(/\d+/);
    const minutes = m ? Math.min(180, Math.max(1, Number(m[0]))) : 25;
    return {
      kind: "focus",
      title: text || raw,
      body: "",
      tags: [],
      priority: undefined,
      dueDate: undefined,
      minutes,
    };
  }
  if (!text) return empty;

  // A bare link is reference material, not an action.
  if (isBareUrl(text) && forced === null)
    return {
      kind: "note",
      title: text,
      body: text,
      tags: [],
      priority: undefined,
      dueDate: undefined,
    };

  if (forced === "habit") {
    const parsed = parseQuickAdd(text, today);
    return {
      kind: "habit",
      title: parsed.title || text,
      body: "",
      tags: parsed.tags,
      priority: undefined,
      dueDate: undefined,
    };
  }

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const kind: CaptureKind = forced ?? (lines.length > 1 || text.length > 240 ? "note" : "task");

  if (kind === "note") {
    const title = (lines[0] ?? text).slice(0, 120);
    return { kind, title, body: text, tags: [], priority: undefined, dueDate: undefined };
  }
  const parsed = parseQuickAdd(text, today);
  return {
    kind,
    title: parsed.title || text,
    body: "",
    tags: parsed.tags,
    priority: parsed.priority,
    dueDate: parsed.dueDate,
  };
}
