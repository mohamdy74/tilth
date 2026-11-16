import { createFileRoute } from "@tanstack/react-router";
import { Check, Clock, Plus, MoreHorizontal, Timer } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { usePrefs } from "@/components/app/preferences";
import { PageHeader } from "@/components/app/PageHeader";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate, formatNumber } from "@/lib/i18n";
import { buildDayPlan } from "@/lib/plan";
import {
  habits as habitApi,
  tasks as taskApi,
  todayLocal,
  useStore,
} from "@/lib/store";
import type { Task } from "@/lib/types";

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
const DAY_SPAN_MIN = DAY_END_MIN - DAY_START_MIN;

function mm(ss: number): string {
  const h = Math.floor(ss / 60);
  const m = ss % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function PlanPage() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const settings = useStore((s) => s.settings);
  const allTasks = useStore((s) => s.tasks);
  const allHabits = useStore((s) => s.habits);
  const allLogs = useStore((s) => s.habitLogs);
  const today = todayLocal();

  const [view, setView] = useState<"today">("today");

  if (!ready) return null;

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

  const onTaskToggle = useCallback((id: string) => {
    const task = allTasks.find((x) => x.id === id);
    if (!task) return;
    if (task.status === "done") taskApi.reopen(id);
    else taskApi.complete(id);
  }, [allTasks]);

  const onHabitToggle = useCallback((id: string) => {
    const habit = allHabits.find((x) => x.id === id);
    if (!habit) return;
    const done = allLogs.some(
      (l) => !l.deletedAt && l.habitId === id && l.localDay === today && l.status === "done",
    );
    if (done) habitApi.unlog(id, today);
    else habitApi.log(id, "done", today);
  }, [allHabits, allLogs, today]);

  return (
    <div className="space-y-3">
      <PageHeader
        context={
          <>
            <Clock className="size-4 shrink-0" aria-hidden />
            <span>{formatDate(locale, new Date(today + "T00:00:00"))}</span>
            {plan.overflowTasks.length > 0 && (
              <>
                <span className="mx-2">·</span>
                <span className="text-destructive">{plan.overflowTasks.length} {t.plan.overflow}</span>
              </>
            )}
          </>
        }
        title={t.plan.title}
        lede={plan.overflowTasks.length === 0 ? t.plan.emptyDay : t.plan.overflowHint}
      />

      <div className="grid gap-3 md:grid-cols-12 lg:grid-cols-8">
        {/* Timeline */}
        <div
          className="lg:col-span-5 relative min-h-[400px] rounded-2xl border border-border bg-card panel"
          style={{ padding: 0 }}
        >
          <div
            className="absolute inset-0 flex flex-col"
            style={{
              paddingTop: `${(DAY_START_MIN / DAY_SPAN_MIN) * 100}%`,
              paddingBottom: `${((DAY_SPAN_MIN - (DAY_END_MIN - DAY_START_MIN)) / DAY_SPAN_MIN) * 100}%`,
            }}
          >
            {/* hour ticks */}
            {Array.from({ length: 14 }, (_, i) => {
              const min = DAY_START_MIN + i * 60;
              if (min > DAY_END_MIN) return null;
              return (
                <div
                  key={min}
                  className="absolute left-0 right-0 flex items-center gap-2 px-2 border-b border-border/50"
                  style={{ top: `${((min - DAY_START_MIN) / DAY_SPAN_MIN) * 100}%` }}
                >
                  <span className="w-10 shrink-0 text-[10px] text-muted-foreground tabular-nums">
                    {mm(min)}
                  </span>
                </div>
              );
            })}
            {/* blocks */}
            {plan.blocks.map((b) => {
              const kindColor: Record<string, string> = {
                task: "border-primary bg-primary/5",
                habit: "border-accent bg-accent/5",
                focus: "border-destructive bg-destructive/5",
              };
              const top = ((b.startMinute - DAY_START_MIN) / DAY_SPAN_MIN) * 100;
              const height = (b.minutes / DAY_SPAN_MIN) * 100;
              const isTask = b.kind === "task";
              return (
                <div
                  key={b.id}
                  className={cn(
                    "absolute left-0 right-0 rounded-xl border-l-4 border shadow-soft flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-all hover:shadow-lift",
                    kindColor[b.kind],
                  )}
                  style={{
                    top: `${top}%`,
                    height: `${Math.max(height, 3)}%`,
                  }}
                >
                  <span className="w-10 shrink-0 text-[11px] text-muted-foreground tabular-nums rtl-flip">
                    {mm(b.startMinute)}
                  </span>
                  {b.kind === "focus" && (
                    <Timer className="size-4 shrink-0" aria-hidden />
                  )}
                  <span className="flex-1 min-w-0 truncate">
                    {b.kind === "focus"
                      ? t.plan.focusBlock
                      : b.kind === "habit"
                        ? t.plan.habitBlock
                        : b.title}
                  </span>
                  {isTask && (
                    <button
                      type="button"
                      aria-pressed={b.done}
                      onClick={() => onTaskToggle(b.sourceId)}
                      className="shrink-0 p-1 rounded hover:bg-accent/40"
                      aria-label={b.done ? "mark done" : "mark open"}
                    >
                      <Check className={cn("size-3.5", b.done ? "text-primary" : "text-muted-foreground")} aria-hidden />
                    </button>
                  )}
                  {!isTask && b.done && (
                    <Check className="size-4 shrink-0 text-primary" aria-hidden />
                  )}
                  <MoreHorizontal className="size-4 shrink-0 text-muted-foreground rtl-flip" aria-hidden />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: details + overflow */}
        <div className="lg:col-span-7 space-y-3">
          <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">{t.plan.title}</h2>
              <span className="text-xs text-muted-foreground">
                {formatNumber(locale, plan.totalMinutes)} {t.plan.minutes}
              </span>
            </div>
            {plan.blocks.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                {t.plan.noTasks}
                <p className="mt-1 text-xs">{t.plan.noTasksBody}</p>
              </div>
            )}
            {plan.blocks.map((b) => {
              const isTask = b.kind === "task";
              const showToggle = isTask;
              const done = isTask ? b.done : b.done;
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-lg border border-transparent p-2 hover:bg-accent/40 transition-colors"
                >
                  {showToggle && (
                    <button
                      type="button"
                      aria-pressed={done}
                      onClick={() => onTaskToggle(b.sourceId)}
                      className="shrink-0 rounded p-1 hover:bg-accent/40"
                      aria-label={done ? "mark done" : "mark open"}
                    >
                      <Check
                        className={cn("size-4", done ? "text-primary" : "text-muted-foreground")}
                        aria-hidden
                      />
                    </button>
                  )}
                  {!showToggle && done && (
                    <Check className="size-4 shrink-0 text-primary" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground truncate">
                        {b.kind === "focus" ? t.plan.focusBlock : b.title}
                      </span>
                      {b.kind === "task" && b.priority && (
                        <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold border-transparent">
                          {b.priority === "high" ? "!" : b.priority === "medium" ? "‧" : "–"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span>{mm(b.startMinute)}</span>
                      <span>·</span>
                      <span>{formatNumber(locale, b.minutes)} {t.plan.minutes}</span>
                      {b.kind === "habit" && done && <span>✓</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {plan.overflowTasks.length > 0 && (
            <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 shadow-soft">
              <h3 className="text-sm font-semibold text-destructive">{t.plan.overflow}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.plan.overflowHint}</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {plan.overflowTasks.map((title) => (
                  <li key={title} className="flex items-center gap-2 rounded bg-background p-2">
                    <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="flex-1 truncate text-foreground">{title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
