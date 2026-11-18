import { describe, expect, it } from "vitest";
import { normalizeText, searchAll } from "./search";
import type { Habit, Note, Task } from "./types";

const t = (over: Partial<Task>): Task => ({
  id: "t",
  title: "Buy milk",
  notes: "from the store",
  tags: ["grocery"],
  status: "todo",
  priority: "medium",
  dueDate: undefined,
  subtasks: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  kanbanOrder: 0,
  ...over,
});
const n = (over: Partial<Note>): Note => ({
  id: "n",
  title: "Meeting",
  body: "discuss the quarterly plan",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...over,
});
const h = (over: Partial<Habit>): Habit => ({
  id: "h",
  name: "Drink water",
  schedule: { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
  archived: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...over,
});

describe("search", () => {
  it("short query returns nothing", () => {
    expect(searchAll({ tasks: [], notes: [], habits: [] }, "a")).toEqual([]);
  });

  it("matches task title, tags and notes", () => {
    const r = searchAll(
      {
        tasks: [t({ title: "Buy milk", tags: ["grocery"], notes: "from the store" })],
        notes: [],
        habits: [],
      },
      "grocery",
    );
    expect(r[0]!.kind).toBe("task");
    expect(r[0]!.title).toBe("Buy milk");
  });

  it("matches note title and body with snippet", () => {
    const r = searchAll(
      { tasks: [], notes: [n({ body: "discuss the quarterly plan" })], habits: [] },
      "quarterly",
    );
    expect(r[0]!.kind).toBe("note");
    expect(r[0]!.snippet).toContain("quarterly");
  });

  it("matches habit name", () => {
    const r = searchAll({ tasks: [], notes: [], habits: [h({ name: "Drink water" })] }, "water");
    expect(r[0]!.kind).toBe("habit");
  });

  it("excludes soft-deleted records and archived habits", () => {
    const r = searchAll(
      {
        tasks: [t({ id: "a", deletedAt: "2026-01-01T00:00:00Z" })],
        notes: [n({ id: "b", deletedAt: "2026-01-01T00:00:00Z" })],
        habits: [h({ id: "c", archived: true })],
      },
      "milk",
    );
    expect(r).toEqual([]);
  });

  it("arabic normalization: diacritics + alef + ta-marbuta", () => {
    // "الصلاة" (with shadda on Sad) vs "الصلاه" (ta-marbuta -> ha)
    expect(normalizeText("\u0627\u0644\u0635\u0651\u0644\u0627\u0629")).toBe(
      normalizeText("\u0627\u0644\u0635\u0644\u0627\u0647"),
    );
    // alef variants -> ا
    expect(normalizeText("\u0623\u0644\u062a\u0648")).toBe(
      normalizeText("\u0627\u0644\u062a\u0648"),
    );
    const r = searchAll(
      { tasks: [t({ title: "\u0627\u0644\u0635\u0644\u0627\u0647" })], notes: [], habits: [] },
      "\u0627\u0644\u0635\u0644\u0627\u0629",
    );
    expect(r.length).toBe(1);
  });

  it("title match ranks above body match", () => {
    const r = searchAll(
      { tasks: [], notes: [n({ title: "X", body: "the quarterly report" })], habits: [] },
      "quarterly",
    );
    expect(r[0]!.kind).toBe("note");
  });

  it("perKind and limit caps respected", () => {
    const tasks = Array.from({ length: 10 }, (_, i) => t({ id: `t${i}`, title: `Match ${i}` }));
    const r = searchAll({ tasks, notes: [], habits: [] }, "match", { perKind: 3, limit: 100 });
    expect(r.length).toBe(3);
  });

  it("returns a note matched on body only", () => {
    const r = searchAll(
      { tasks: [], notes: [n({ title: "Untitled", body: "the quarterly report" })], habits: [] },
      "quarterly",
    );
    expect(r.length).toBe(1);
    expect(r[0]!.title).toBe("Untitled");
  });
});
