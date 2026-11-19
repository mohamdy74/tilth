import { describe, expect, it } from "vitest";
import { extractChecklistTasks } from "./noteTasks";
import type { Note } from "./types";

function note(body: string): Note {
  return {
    id: "n1",
    title: "Note",
    body,
    createdAt: "2026-11-01T08:00:00Z",
    updatedAt: "2026-11-01T08:00:00Z",
  };
}

describe("extractChecklistTasks", () => {
  it("pulls unchecked items only, linked to the note", () => {
    const n = note("- [ ] buy milk\n- [x] already done\n* [ ] call Sam\n- [ ] write report");
    const items = extractChecklistTasks(n);
    expect(items.map((i) => i.title)).toEqual(["buy milk", "call Sam", "write report"]);
    expect(items.every((i) => i.linkedTaskId === "n1")).toBe(true);
  });

  it("skips fenced code blocks", () => {
    const n = note("```\n- [ ] not a task\n```\n- [ ] real task");
    const items = extractChecklistTasks(n);
    expect(items.map((i) => i.title)).toEqual(["real task"]);
  });

  it("returns none when there are no unchecked items", () => {
    expect(extractChecklistTasks(note("- [x] done\n- [x] also done")).length).toBe(0);
    expect(extractChecklistTasks(note("just a paragraph")).length).toBe(0);
  });
});
