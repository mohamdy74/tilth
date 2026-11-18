import { describe, expect, it } from "vitest";
import { buildTaskViews } from "./taskViews";
import type { Task } from "./types";

const TODAY = "2026-11-18";
const options = {
  today: TODAY,
  priority: "all" as const,
  tag: "all",
  search: "",
  sort: "due" as const,
};

const mk = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  title: id,
  priority: "medium",
  tags: [],
  subtasks: [],
  status: "todo",
  kanbanOrder: 0,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  ...over,
});

describe("buildTaskViews", () => {
  it("buckets by the stored local day and gives completed tasks precedence", () => {
    const views = buildTaskViews(
      [
        mk("done-overdue", {
          status: "done",
          dueDate: "2026-11-17",
          completedAt: "2026-11-18T08:00:00.000Z",
        }),
        mk("inbox"),
        mk("overdue", { dueDate: "2026-11-17" }),
        mk("today", { dueDate: TODAY }),
        mk("upcoming", { dueDate: "2026-11-19" }),
      ],
      options,
    );

    expect(views.completed.map((t) => t.id)).toEqual(["done-overdue"]);
    expect(views.inbox.map((t) => t.id)).toEqual(["inbox"]);
    expect(views.overdue.map((t) => t.id)).toEqual(["overdue"]);
    expect(views.today.map((t) => t.id)).toEqual(["today"]);
    expect(views.upcoming.map((t) => t.id)).toEqual(["upcoming"]);
  });

  it("applies priority, exact tag, and trimmed text filters", () => {
    const tasks = [
      mk("title", { title: "Buy MILK", priority: "high", tags: ["errands"] }),
      mk("notes", {
        title: "Weekly shop",
        notes: "Need milk",
        priority: "high",
        tags: ["errands"],
      }),
      mk("tag", { title: "Other", priority: "high", tags: ["errands", "milk"] }),
      mk("wrong-priority", { title: "milk", priority: "medium", tags: ["errands"] }),
      mk("wrong-tag", { title: "milk", priority: "high", tags: ["home"] }),
      mk("unrelated", { title: "Other", priority: "high", tags: ["errands"] }),
    ];

    const views = buildTaskViews(tasks, {
      ...options,
      priority: "high",
      tag: "errands",
      search: " MILK ",
    });

    expect(new Set(views.inbox.map((t) => t.id))).toEqual(new Set(["title", "notes", "tag"]));
  });

  it("uses the selected ordering for active buckets", () => {
    const views = buildTaskViews(
      [mk("low", { priority: "low" }), mk("high", { priority: "high" })],
      { ...options, sort: "priority" },
    );

    expect(views.inbox.map((t) => t.id)).toEqual(["high", "low"]);
  });

  it("sorts completed tasks by recency for due views and by the selected sort otherwise", () => {
    const tasks = [
      mk("old", {
        status: "done",
        dueDate: "2026-11-01",
        completedAt: "2026-11-01T09:00:00.000Z",
        createdAt: "2026-11-01T08:00:00.000Z",
      }),
      mk("new", {
        status: "done",
        dueDate: "2026-11-20",
        completedAt: "2026-11-03T09:00:00.000Z",
        createdAt: "2026-11-02T08:00:00.000Z",
      }),
    ];

    expect(buildTaskViews(tasks, options).completed.map((t) => t.id)).toEqual(["new", "old"]);
    expect(
      buildTaskViews(tasks, { ...options, sort: "created" }).completed.map((t) => t.id),
    ).toEqual(["old", "new"]);
  });

  it("does not mutate the input array", () => {
    const a = mk("a", { dueDate: TODAY });
    const b = mk("b", { dueDate: TODAY });
    const input = [b, a];

    const views = buildTaskViews(input, options);

    expect(input.map((t) => t.id)).toEqual(["b", "a"]);
    expect(views.today.map((t) => t.id)).toEqual(["a", "b"]);
  });
});
