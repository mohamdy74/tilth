import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  GripVertical,
  ListTodo,
  Pin,
  PinOff,
  Repeat,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { useCallback, useMemo, type DragEvent } from "react";
import { usePrefs } from "@/components/app/preferences";
import { PageHeader } from "@/components/app/PageHeader";
import { PriorityMark } from "@/components/app/PriorityMark";
import { cn } from "@/lib/utils";
import { formatDate, formatNumber, type Locale } from "@/lib/i18n";
import { buildDayPlan, type PlanBlock } from "@/lib/plan";
import { habits as habitApi, tasks as taskApi, todayLocal, useStore } from "@/lib/store";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Day plan — Tilth" },
      {
        name: "description",
        content: "Everything due today, laid out on one timeline.",
      },
      { property: "og:title", content: "Day plan — Tilth" },
      {
        property: "og:description",
        content: "Everything due today, laid out on one timeline.",
      },
    ],
  }),
  component: PlanPage,
});

const DAY_START_MIN = 9 * 60; // 09:00
const DAY_END_MIN = 22 * 60; // 22:00
const HOUR_PX = 56; // fixed pixel rhythm — percentage padding is width-relative in CSS
const MIN_BLOCK_PX = 30;
const BLOCK_GAP_PX = 4;

/** Localized wall-clock label for minutes-from-midnight (Intl digits in Arabic). */
function timeLabel(locale: Locale, minutes: number): string {
  const d = new Date(Date.UTC(2023, 0, 1, Math.floor(minutes / 60), minutes % 60));
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(d);
}

const KIND_CLS: Record<PlanBlock["kind"], string> = {
  task: "border-s-primary bg-primary/5",
  habit: "border-s-success bg-success/10",
  focus: "border-s-info bg-info/10",
};

function PlanPage() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const settings = useStore((s) => s.settings);
  const allTasks = useStore((s) => s.tasks);
  const allHabits = useStore((s) => s.habits);
  const allLogs = useStore((s) => s.habitLogs);
  const today = todayLocal();

  const plan = useMemo(
    () =>
      buildDayPlan({
        today,
        tasks: allTasks,
        habits: allHabits,
        habitLogs: allLogs,
        focusTargetMinutes: settings.dailyFocusTargetMinutes,
        dayStartHour: settings.dayStartHour,
        startMinute: DAY_START_MIN,
        endOfDayMinute: DAY_END_MIN,
      }),
    [allTasks, allHabits, allLogs, settings.dailyFocusTargetMinutes, settings.dayStartHour, today],
  );

  const onTaskToggle = useCallback(
    (id: string) => {
      const task = allTasks.find((x) => x.id === id);
      if (!task) return;
      if (task.status === "done") taskApi.reopen(id);
      else taskApi.complete(id);
    },
    [allTasks],
  );

  const onHabitToggle = useCallback(
    (id: string) => {
      const done = allLogs.some(
        (l) => !l.deletedAt && l.habitId === id && l.localDay === today && l.status === "done",
      );
      if (done) habitApi.unlog(id, today);
      else habitApi.log(id, "done", today);
    },
    [allLogs, today],
  );

  const pinTask = (id: string, minute: number, undoMinute: number | undefined) => {
    taskApi.update(id, { blockStart: minute });
    toast(t.plan.pinned, {
      action: {
        label: t.shop.undo,
        onClick: () => taskApi.update(id, { blockStart: undoMinute }),
      },
    });
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const raw = DAY_START_MIN + (y / HOUR_PX) * 60;
    const minute = Math.min(DAY_END_MIN - 5, Math.max(DAY_START_MIN, Math.round(raw / 5) * 5));
    const prev = allTasks.find((x) => x.id === id)?.blockStart;
    pinTask(id, minute, prev);
  };

  const nudge = (id: string, delta: number) => {
    const task = allTasks.find((x) => x.id === id);
    if (!task) return;
    const block = plan.blocks.find((b) => b.kind === "task" && b.sourceId === id);
    const base = task.blockStart ?? block?.startMinute ?? DAY_START_MIN;
    const minute = Math.min(DAY_END_MIN - 5, Math.max(DAY_START_MIN, base + delta));
    taskApi.update(id, { blockStart: minute });
  };

  // Display layout: blocks keep their engine order but never overlap — a block
  // shorter than MIN_BLOCK_PX pushes the next one down by a few pixels instead
  // of stacking on top of it. Hour ticks stay at their true positions.
  const layout = useMemo(() => {
    let prevBottom = 0;
    const rows = plan.blocks.map((b) => {
      const startPx = ((b.startMinute - DAY_START_MIN) / 60) * HOUR_PX;
      const top = Math.max(startPx, prevBottom + BLOCK_GAP_PX);
      const height = Math.max((b.minutes / 60) * HOUR_PX, MIN_BLOCK_PX);
      prevBottom = top + height;
      return { block: b, top, height };
    });
    const baseHeight = ((DAY_END_MIN - DAY_START_MIN) / 60) * HOUR_PX;
    return { rows, height: Math.max(baseHeight, prevBottom + 12) };
  }, [plan.blocks]);

  // Hooks must run on every render, so the ready gate sits below them.
  if (!ready) {
    return (
      <div aria-busy="true" className="space-y-3">
        <div className="skeleton h-9 w-64 max-w-full" />
        <div className="skeleton h-[420px] rounded-2xl" />
      </div>
    );
  }

  const hours = Array.from(
    { length: Math.floor((DAY_END_MIN - DAY_START_MIN) / 60) + 1 },
    (_, i) => DAY_START_MIN + i * 60,
  );

  const blockTitle = (b: PlanBlock) =>
    b.kind === "focus" ? t.plan.focusBlock : b.kind === "habit" ? b.title : b.title;

  const toggleLabel = (done: boolean) => (done ? t.tasks.reopen : t.tasks.markDone);

  return (
    <section>
      <PageHeader
        context={
          <>
            <Clock className="size-4 shrink-0" aria-hidden />
            <span>{formatDate(locale, new Date(today + "T00:00:00"))}</span>
            {plan.overflowTasks.length > 0 && (
              <>
                <span className="mx-2">·</span>
                <span className="text-warning">
                  {formatNumber(locale, plan.overflowTasks.length) + " " + t.plan.overflow}
                </span>
              </>
            )}
          </>
        }
        title={t.plan.title}
        lede={
          plan.overflowTasks.length > 0
            ? t.plan.overflowHint
            : plan.blocks.length === 0
              ? t.plan.emptyDay
              : t.plan.body
        }
      />

      <p className="mb-3 text-xs text-muted-foreground">{t.plan.dragHint}</p>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Timeline */}
        <div className="panel overflow-hidden p-0 lg:col-span-7">
          <div
            className="relative"
            style={{ height: layout.height }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            {hours.map((min) => (
              <div
                key={min}
                className="absolute inset-x-0 flex items-center border-b border-border/50"
                style={{ top: ((min - DAY_START_MIN) / 60) * HOUR_PX }}
              >
                <span className="w-14 shrink-0 ps-3 text-[10px] text-muted-foreground tabular-nums">
                  {timeLabel(locale, min)}
                </span>
              </div>
            ))}
            {layout.rows.map(({ block: b, top, height }) => {
              const isTask = b.kind === "task";
              const KindIcon = b.kind === "focus" ? Timer : b.kind === "habit" ? Repeat : ListTodo;
              const inner = (
                <>
                  <span className="w-12 shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {timeLabel(locale, b.startMinute)}
                  </span>
                  <KindIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      b.done && "text-muted-foreground line-through",
                    )}
                  >
                    {blockTitle(b)}
                  </span>
                  {isTask && b.priority && (
                    <PriorityMark priority={b.priority} label={t.tasks.priority[b.priority]} />
                  )}
                  {isTask &&
                    allTasks.find((x) => x.id === b.sourceId)?.blockStart !== undefined && (
                      <Pin className="size-3.5 shrink-0 text-primary" aria-label={t.plan.pinned} />
                    )}
                  {b.done && !isTask && (
                    <Check className="animate-check size-4 shrink-0 text-success" aria-hidden />
                  )}
                </>
              );
              const cls = cn(
                "absolute flex items-center gap-2 rounded-lg border border-border/60 border-s-4 px-2.5 text-sm font-medium shadow-soft transition-shadow hover:shadow-lift",
                KIND_CLS[b.kind],
                b.done && "opacity-70",
              );
              const pos = {
                top,
                height,
                insetInlineStart: "3.5rem",
                insetInlineEnd: "0.75rem",
              };
              if (isTask) {
                return (
                  <div key={b.id} className={cls} style={pos}>
                    {inner}
                    <button
                      type="button"
                      aria-pressed={b.done}
                      onClick={() => onTaskToggle(b.sourceId)}
                      aria-label={toggleLabel(b.done)}
                      className="hit-extend shrink-0 rounded-full p-1 hover:bg-accent/40"
                    >
                      <Check
                        className={cn(
                          "size-4",
                          b.done ? "animate-check text-primary" : "text-muted-foreground",
                        )}
                        aria-hidden
                      />
                    </button>
                  </div>
                );
              }
              if (b.kind === "habit") {
                return (
                  <button
                    key={b.id}
                    type="button"
                    aria-pressed={b.done}
                    aria-label={b.title + " — " + toggleLabel(b.done)}
                    onClick={() => onHabitToggle(b.sourceId)}
                    className={cn(cls, "text-start")}
                    style={pos}
                  >
                    {inner}
                  </button>
                );
              }
              return (
                <Link key={b.id} to="/focus" className={cls} style={pos}>
                  {inner}
                </Link>
              );
            })}
            {plan.blocks.length === 0 && (
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <p className="font-display text-lg font-semibold">{t.plan.noTasks}</p>
                  <p className="mt-1 max-w-64 text-sm text-muted-foreground">
                    {t.plan.noTasksBody}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Details + overflow */}
        <div className="space-y-4 lg:col-span-5">
          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="panel-title p-0 text-sm">{t.plan.title}</h2>
              <span className="chip tabular-nums">
                {formatNumber(locale, plan.totalMinutes) + " " + t.plan.minutes}
              </span>
            </div>
            {plan.blocks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t.plan.emptyDay}</p>
            ) : (
              <ul className="space-y-1">
                {plan.blocks.map((b) => {
                  const isTask = b.kind === "task";
                  const pinned =
                    isTask && allTasks.find((x) => x.id === b.sourceId)?.blockStart !== undefined;
                  return (
                    <li
                      key={b.id}
                      draggable={isTask}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", b.sourceId);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-accent/30",
                        isTask && "cursor-grab active:cursor-grabbing",
                      )}
                    >
                      {isTask && (
                        <GripVertical
                          className="size-3.5 shrink-0 text-muted-foreground/60"
                          aria-hidden
                        />
                      )}
                      {isTask ? (
                        <button
                          type="button"
                          aria-pressed={b.done}
                          onClick={() => onTaskToggle(b.sourceId)}
                          aria-label={toggleLabel(b.done)}
                          className="hit-extend shrink-0 rounded-full p-1 hover:bg-accent/40"
                        >
                          <Check
                            className={cn(
                              "size-4",
                              b.done ? "animate-check text-primary" : "text-muted-foreground",
                            )}
                            aria-hidden
                          />
                        </button>
                      ) : b.kind === "habit" ? (
                        <button
                          type="button"
                          aria-pressed={b.done}
                          onClick={() => onHabitToggle(b.sourceId)}
                          aria-label={b.title + " — " + toggleLabel(b.done)}
                          className="hit-extend shrink-0 rounded-full p-1 hover:bg-accent/40"
                        >
                          <Check
                            className={cn(
                              "size-4",
                              b.done ? "animate-check text-success" : "text-muted-foreground",
                            )}
                            aria-hidden
                          />
                        </button>
                      ) : (
                        <Timer className="size-4 shrink-0 text-info" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "truncate text-sm font-medium",
                              b.done && "text-muted-foreground line-through",
                            )}
                          >
                            {blockTitle(b)}
                          </span>
                          {isTask && b.priority && (
                            <PriorityMark
                              priority={b.priority}
                              label={t.tasks.priority[b.priority]}
                            />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {timeLabel(locale, b.startMinute) +
                            " · " +
                            formatNumber(locale, b.minutes) +
                            " " +
                            t.plan.minutes}
                        </p>
                      </div>
                      {isTask && (
                        <span className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => nudge(b.sourceId, -15)}
                            aria-label={t.plan.earlier}
                            title={t.plan.earlier}
                            className="hit-extend rounded p-1 text-muted-foreground hover:bg-accent/40"
                          >
                            <ChevronUp className="size-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => nudge(b.sourceId, 15)}
                            aria-label={t.plan.later}
                            title={t.plan.later}
                            className="hit-extend rounded p-1 text-muted-foreground hover:bg-accent/40"
                          >
                            <ChevronDown className="size-3.5" aria-hidden />
                          </button>
                          {pinned && (
                            <button
                              type="button"
                              onClick={() => taskApi.update(b.sourceId, { blockStart: undefined })}
                              aria-label={t.plan.unpin}
                              title={t.plan.unpin}
                              className="hit-extend rounded p-1 text-primary hover:bg-accent/40"
                            >
                              <PinOff className="size-3.5" aria-hidden />
                            </button>
                          )}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {plan.overflowTasks.length > 0 && (
            <div className="rounded-xl border border-warning/50 bg-warning/10 p-4 shadow-soft">
              <h3 className="text-sm font-semibold text-warning">{t.plan.overflow}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.plan.overflowHint}</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {plan.overflowTasks.map((title) => (
                  <li key={title} className="rounded-lg bg-background p-2">
                    <span className="block truncate">{title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
