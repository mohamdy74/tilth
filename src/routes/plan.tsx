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
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { usePrefs } from "@/components/app/preferences";
import { PageHeader } from "@/components/app/PageHeader";
import { PriorityMark } from "@/components/app/PriorityMark";
import { PRIMARY_BTN } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate, formatNumber } from "@/lib/i18n";
import { buildDayPlan, formatClock, layoutDayPlan, type PlanBlock } from "@/lib/plan";
import { suggestTaskStart } from "@/lib/energy";
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
const HOUR_PX = 64;
const MIN_BLOCK_PX = 28;
const GUTTER_PX = 48;
const BLOCK_GAP_PX = 6;

const KIND_CLS: Record<PlanBlock["kind"], string> = {
  task: "border-s-primary bg-primary/10",
  habit: "border-s-success bg-success/10",
  focus: "border-s-info bg-info/10",
};

function checkTone(kind: PlanBlock["kind"], done: boolean): string {
  if (!done) return "size-4 text-muted-foreground";
  return kind === "task"
    ? "size-4 animate-check text-primary"
    : "size-4 animate-check text-success";
}

/** Wall-clock minutes since midnight, refreshed once a minute (render only). */
function useNowMinute(): number | null {
  const [minute, setMinute] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setMinute(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return minute;
}

function PlanPage() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const settings = useStore((s) => s.settings);
  const allTasks = useStore((s) => s.tasks);
  const allHabits = useStore((s) => s.habits);
  const allLogs = useStore((s) => s.habitLogs);
  const today = todayLocal();
  const nowMinute = useNowMinute();

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

  const layout = useMemo(
    () =>
      layoutDayPlan(plan.blocks, {
        startMinute: DAY_START_MIN,
        endMinute: DAY_END_MIN,
        hourPx: HOUR_PX,
        minBlockPx: MIN_BLOCK_PX,
      }),
    [plan.blocks],
  );

  const pinnedIds = useMemo(
    () => new Set(allTasks.filter((x) => x.blockStart !== undefined).map((x) => x.id)),
    [allTasks],
  );

  const openHigh = useMemo(
    () =>
      allTasks.filter(
        (x) =>
          !x.deletedAt &&
          x.status !== "done" &&
          x.priority === "high" &&
          !x.blockStart &&
          (x.dueDate === undefined || x.dueDate <= today),
      ),
    [allTasks, today],
  );
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const suggestion = useMemo(() => {
    const task = openHigh[0];
    if (!task) return undefined;
    return suggestTaskStart(task, allTasks, {
      today,
      days: 28,
      dayStartHour: settings.dayStartHour,
      timeZone: tz,
    });
  }, [openHigh, allTasks, settings.dayStartHour, today, tz]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const didScroll = useRef(false);
  useEffect(() => {
    if (!ready || nowMinute === null || didScroll.current || plan.blocks.length === 0) return;
    const el = scrollerRef.current;
    if (!el) return;
    didScroll.current = true;
    const nowInRange = nowMinute >= DAY_START_MIN && nowMinute <= DAY_END_MIN;
    const anchor = nowInRange ? nowMinute : plan.blocks[0]!.startMinute;
    const target = ((anchor - DAY_START_MIN) / 60) * HOUR_PX - HOUR_PX;
    el.scrollTop = Math.max(0, Math.min(target, el.scrollHeight - el.clientHeight));
  }, [ready, nowMinute, plan.blocks]);

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

  // Hooks must run on every render, so the ready gate sits below them.
  if (!ready) {
    return (
      <div aria-busy="true" className="space-y-3">
        <div className="skeleton h-9 w-64 max-w-full" />
        <div className="skeleton h-[420px] rounded-2xl" />
      </div>
    );
  }

  const blockTitle = (b: PlanBlock) => (b.kind === "focus" ? t.plan.focusBlock : b.title);
  const toggleLabel = (done: boolean) => (done ? t.tasks.reopen : t.tasks.markDone);
  const hasItems = plan.blocks.some((b) => b.kind !== "focus");
  const nowInRange = nowMinute !== null && nowMinute >= DAY_START_MIN && nowMinute <= DAY_END_MIN;
  const nowTop = nowInRange ? ((nowMinute! - DAY_START_MIN) / 60) * HOUR_PX : 0;

  const hourLabels = Array.from(
    { length: (DAY_END_MIN - DAY_START_MIN) / 60 },
    (_, i) => DAY_START_MIN + i * 60,
  );
  const hourLines = [...hourLabels, DAY_END_MIN];
  const halfHours = hourLabels.map((m) => m + 30);

  return (
    <section>
      <PageHeader
        context={
          <>
            <Clock className="size-4 shrink-0" aria-hidden />
            <span>{formatDate(locale, new Date(today + "T00:00:00"))}</span>
            {plan.overflowTasks.length > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="text-warning">
                  {formatNumber(locale, plan.overflowTasks.length) + " " + t.plan.overflow}
                </span>
              </>
            )}
          </>
        }
        title={t.plan.title}
        lede={
          plan.overflowTasks.length > 0 ? t.plan.overflowHint : hasItems ? t.plan.body : undefined
        }
      />

      {suggestion && openHigh[0] && (
        <div className="mt-4 panel flex items-center gap-3 p-3">
          <Clock className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="text-sm font-medium">{t.energy.title}</span>
            <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              {openHigh[0]?.title}
              <span className="inline-flex items-center gap-1 rounded border border-accent/40 px-2 py-0.5 text-[11px] text-accent">
                {suggestion.label}
              </span>
            </span>
            <p className="mt-1 text-xs text-muted-foreground">{t.energy.hint}</p>
          </span>
          <button
            type="button"
            onClick={() => {
              taskApi.update(suggestion.taskId, { blockStart: suggestion.startMinute });
              toast(t.plan.pinned);
            }}
            className={PRIMARY_BTN + " px-3 py-1.5"}
          >
            {t.energy.button.replace("{time}", suggestion.label)}
          </button>
        </div>
      )}

      {!hasItems ? (
        <div className="panel mt-2 px-6 py-10 text-center">
          <p className="font-display text-lg font-semibold">{t.plan.noTasks}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {t.plan.noTasksBody}
          </p>
          <Link to="/tasks" className={cn(PRIMARY_BTN, "mt-4 h-11")}>
            {t.plan.planYourDay}
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">{t.plan.dragHint}</p>

          <div className="panel overflow-hidden p-0">
            <div
              ref={scrollerRef}
              role="region"
              aria-label={t.plan.title}
              tabIndex={0}
              className="relative max-h-[calc(100dvh-17rem)] overflow-y-auto overscroll-contain lg:max-h-[44rem]"
            >
              <div
                className="relative"
                style={{ height: layout.height }}
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                {hourLines.map((min) => {
                  const past = nowMinute !== null && min < nowMinute;
                  return (
                    <div
                      key={min}
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute inset-x-0 border-t",
                        past ? "border-border/30" : "border-border/60",
                      )}
                      style={{ top: ((min - DAY_START_MIN) / 60) * HOUR_PX }}
                    />
                  );
                })}
                {hourLabels.map((min) => {
                  return (
                    <span
                      key={min}
                      aria-hidden
                      className="absolute z-10 -translate-y-1/2 rounded bg-card px-1 text-xs tabular-nums text-muted-foreground"
                      style={{
                        top: ((min - DAY_START_MIN) / 60) * HOUR_PX,
                        insetInlineStart: 0,
                        width: GUTTER_PX,
                        textAlign: "center",
                      }}
                    >
                      {formatClock(locale, min)}
                    </span>
                  );
                })}
                {halfHours.map((min) => (
                  <div
                    key={min}
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/25"
                    style={{ top: ((min - DAY_START_MIN) / 60) * HOUR_PX }}
                  />
                ))}

                {layout.blocks.map(({ block: b, lane, lanes, top, height }) => {
                  const isTask = b.kind === "task";
                  const isFocus = b.kind === "focus";
                  const KindIcon = isFocus ? Timer : b.kind === "habit" ? Repeat : ListTodo;
                  const style = {
                    top,
                    height,
                    insetInlineStart: `calc(${GUTTER_PX}px + (100% - ${GUTTER_PX}px) * ${lane} / ${lanes})`,
                    width: `calc((100% - ${GUTTER_PX}px) / ${lanes} - ${BLOCK_GAP_PX}px)`,
                  };
                  const body = (
                    <>
                      <KindIcon
                        className={cn(
                          "size-3.5 shrink-0 opacity-70",
                          !isFocus && "@max-[150px]:hidden",
                        )}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm font-medium",
                          b.done && "line-through opacity-70",
                        )}
                        style={{ unicodeBidi: "plaintext" }}
                      >
                        {blockTitle(b)}
                      </span>
                      {isTask && pinnedIds.has(b.sourceId) && (
                        <Pin className="size-3 shrink-0 text-primary" aria-hidden />
                      )}
                      <span className="shrink-0 text-xs tabular-nums opacity-70 @max-[150px]:hidden">
                        {formatClock(locale, b.startMinute)}
                      </span>
                    </>
                  );
                  const cls = cn(
                    "@container absolute z-10 flex items-center gap-1.5 rounded-[10px] border-s-[3px] px-2 text-start",
                    KIND_CLS[b.kind],
                    b.done && "opacity-70",
                  );

                  if (isFocus) {
                    return (
                      <Link
                        key={b.id}
                        to="/focus"
                        className={cls}
                        style={style}
                        title={blockTitle(b)}
                      >
                        {body}
                      </Link>
                    );
                  }
                  return (
                    <div key={b.id} className={cls} style={style} title={blockTitle(b)}>
                      {body}
                      <button
                        type="button"
                        aria-pressed={b.done}
                        aria-label={
                          isTask ? toggleLabel(b.done) : b.title + " — " + toggleLabel(b.done)
                        }
                        onClick={() =>
                          isTask ? onTaskToggle(b.sourceId) : onHabitToggle(b.sourceId)
                        }
                        className="hit-extend -me-1 shrink-0 rounded-full p-1 hover:bg-accent/40"
                      >
                        <Check className={cn(checkTone(b.kind, b.done))} aria-hidden />
                      </button>
                    </div>
                  );
                })}

                {nowInRange && nowMinute !== null && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 z-20"
                    style={{ top: nowTop }}
                  >
                    <div className="h-px w-full bg-primary" />
                    <span
                      className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary"
                      style={{ insetInlineStart: GUTTER_PX / 2 - 4 }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {plan.overflowTasks.length > 0 && (
            <div className="mt-4 rounded-xl border border-warning/50 bg-warning/10 p-4">
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

          <div className="panel mt-4 p-0">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
              <h2 className="panel-title p-0 text-sm">{t.plan.agenda}</h2>
              <span className="chip tabular-nums">
                {t.plan.planned.replace("{n}", formatNumber(locale, plan.totalMinutes))}
              </span>
            </div>
            <ul className="p-2">
              {plan.blocks.map((b) => {
                const isTask = b.kind === "task";
                const pinned = isTask && pinnedIds.has(b.sourceId);
                return (
                  <li
                    key={b.id}
                    draggable={isTask}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", b.sourceId);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/30",
                      isTask && "cursor-grab active:cursor-grabbing",
                    )}
                  >
                    {isTask ? (
                      <GripVertical
                        className="size-3.5 shrink-0 text-muted-foreground/60"
                        aria-hidden
                      />
                    ) : (
                      <span className="w-3.5 shrink-0" aria-hidden />
                    )}
                    {b.kind === "focus" ? (
                      <Timer className="size-4 shrink-0 text-info" aria-hidden />
                    ) : (
                      <button
                        type="button"
                        aria-pressed={b.done}
                        onClick={() =>
                          isTask ? onTaskToggle(b.sourceId) : onHabitToggle(b.sourceId)
                        }
                        aria-label={
                          isTask ? toggleLabel(b.done) : b.title + " — " + toggleLabel(b.done)
                        }
                        className="hit-extend shrink-0 rounded-full p-1.5 hover:bg-accent/40"
                      >
                        <Check className={cn(checkTone(b.kind, b.done))} aria-hidden />
                      </button>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "truncate text-sm font-medium",
                            b.done && "text-muted-foreground line-through",
                          )}
                          style={{ unicodeBidi: "plaintext" }}
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
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatClock(locale, b.startMinute) +
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
                          className="hit-extend rounded p-1.5 text-muted-foreground hover:bg-accent/40"
                        >
                          <ChevronUp className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => nudge(b.sourceId, 15)}
                          aria-label={t.plan.later}
                          title={t.plan.later}
                          className="hit-extend rounded p-1.5 text-muted-foreground hover:bg-accent/40"
                        >
                          <ChevronDown className="size-4" aria-hidden />
                        </button>
                        {pinned && (
                          <button
                            type="button"
                            onClick={() => taskApi.update(b.sourceId, { blockStart: undefined })}
                            aria-label={t.plan.unpin}
                            title={t.plan.unpin}
                            className="hit-extend rounded p-1.5 text-primary hover:bg-accent/40"
                          >
                            <PinOff className="size-4" aria-hidden />
                          </button>
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
