import { sortTasks } from "./taskSort";
import type { LocalDay, Priority, Task, TaskBucket, TaskSort } from "./types";

export interface TaskViewOptions {
  today: LocalDay;
  priority: Priority | "all";
  tag: string;
  search: string;
  sort: TaskSort;
}

/** Filter, bucket, and order live tasks using their stored LocalDay values. */
export function buildTaskViews(
  tasks: Task[],
  options: TaskViewOptions,
): Record<TaskBucket, Task[]> {
  const { today, priority, tag, search, sort } = options;
  const q = search.trim().toLowerCase();
  const filtered = tasks.filter(
    (x) =>
      (priority === "all" || x.priority === priority) &&
      (tag === "all" || x.tags.includes(tag)) &&
      (q === "" ||
        x.title.toLowerCase().includes(q) ||
        (x.notes ?? "").toLowerCase().includes(q) ||
        x.tags.some((g) => g.includes(q))),
  );

  const byView: Record<TaskBucket, Task[]> = {
    today: [],
    upcoming: [],
    overdue: [],
    completed: [],
    inbox: [],
  };
  for (const x of filtered) {
    if (x.status === "done") byView.completed.push(x);
    else if (!x.dueDate) byView.inbox.push(x);
    else if (x.dueDate < today) byView.overdue.push(x);
    else if (x.dueDate === today) byView.today.push(x);
    else byView.upcoming.push(x);
  }

  byView.today = sortTasks(byView.today, sort);
  byView.inbox = sortTasks(byView.inbox, sort);
  byView.upcoming = sortTasks(byView.upcoming, sort);
  byView.overdue = sortTasks(byView.overdue, sort);
  byView.completed =
    sort === "due"
      ? [...byView.completed].sort((a, b) =>
          (b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
        )
      : sortTasks(byView.completed, sort);
  return byView;
}
