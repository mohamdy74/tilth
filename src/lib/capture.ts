import { parseQuickAdd } from "./quickAdd";
import type { LocalDay, Priority } from "./types";

/*
 * Smart capture: decide whether pasted text is a task or a note, then shape it.
 * Pure â€” `today` is passed in. Task parsing reuses parseQuickAdd.
 */

export type CaptureKind = "task" | "note";

export interface CaptureResult {
  kind: CaptureKind;
  title: string;
  /** "" for tasks. */
  body: string;
  tags: string[];
  priority: Priority | undefined;
  dueDate: LocalDay | undefined;
}

const NOTE_PREFIX = /^(note|Ù…Ù„Ø§Ø­Ø¸Ø©)\s*:\s*/i;
const TASK_PREFIX = /^(task|Ù…Ù‡Ù…Ø©)\s*:\s*/i;

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
  if (noteM) {
    forced = "note";
    text = raw.slice(noteM[0].length);
  } else if (taskM) {
    forced = "task";
    text = raw.slice(taskM[0].length);
  }
  text = text.trim();
  if (!text) return empty;

  // A bare link is reference material, not an action.
  if (isBareUrl(text))
    return {
      kind: "note",
      title: text,
      body: text,
      tags: [],
      priority: undefined,
      dueDate: undefined,
    };

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
