import type { Note } from "./types";

export interface ChecklistTaskInput {
  title: string;
  linkedTaskId: string;
}

/** Parse unchecked `- [ ]` / `* [ ]` checklist items from a note body into task
 * inputs linked back to the note. Pure.
 *
 * Skips already-checked items and lines inside fenced code blocks (``` ... ```),
 * so a note that documents a checklist isn't mistaken for one to execute. */
export function extractChecklistTasks(note: Note): ChecklistTaskInput[] {
  const items: ChecklistTaskInput[] = [];
  let inCode = false;
  for (const raw of note.body.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const m = line.match(/^[-*]\s*\[\s*\]\s+(.+)$/);
    if (m) {
      items.push({ title: m[1].trim(), linkedTaskId: note.id });
    }
  }
  return items;
}
