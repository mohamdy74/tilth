import type { Task, TaskSort } from "./types";

const PRIORITY_RANK: Record<Task["priority"], number> = { high: 0, medium: 1, low: 2 };

/**
 * Pure task ordering for the list views and saved views.
 * - due: earliest dueDate first, undated last, priority then createdAt tiebreak;
 * - priority: high first, then earlier dueDate, then createdAt;
 * - created: oldest first (stable capture order).
 * Always returns a copy; never mutates the store array.
 */
export function sortTasks(list: Task[], sort: TaskSort): Task[] {
  const byCreated = (a: Task, b: Task) =>
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  const byDue = (a: Task, b: Task) =>
    (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    byCreated(a, b);
  const byPriority = (a: Task, b: Task) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byDue(a, b);
  const cmp = sort === "priority" ? byPriority : sort === "created" ? byCreated : byDue;
  return [...list].sort(cmp);
}
