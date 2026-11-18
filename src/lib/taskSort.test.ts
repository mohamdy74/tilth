import { describe, expect, it } from "vitest";
import { sortTasks } from "./taskSort";
import type { Task } from "./types";

const mk = (over: Partial<Task>): Task => ({
  id: "t",
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
  title: "t",
  priority: "medium",
  tags: [],
  subtasks: [],
  status: "todo",
  kanbanOrder: 0,
  ...over,
});

describe("sortTasks", () => {
  const a = mk({
    id: "a",
    priority: "low",
    dueDate: "2026-11-20",
    createdAt: "2026-11-03T00:00:00Z",
  });
  const b = mk({
    id: "b",
    priority: "high",
    dueDate: "2026-11-19",
    createdAt: "2026-11-02T00:00:00Z",
  });
  const c = mk({ id: "c", priority: "medium", createdAt: "2026-11-01T00:00:00Z" });

  it("due: earliest first, undated last", () => {
    expect(sortTasks([a, b, c], "due").map((t) => t.id)).toEqual(["b", "a", "c"]);
  });

  it("priority: high first then earlier due", () => {
    expect(sortTasks([a, b, c], "priority").map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("created: oldest first", () => {
    expect(sortTasks([a, b, c], "created").map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("never mutates the input array", () => {
    const input = [a, b, c];
    sortTasks(input, "priority");
    expect(input.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
});
