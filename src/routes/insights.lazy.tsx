import { createLazyFileRoute } from "@tanstack/react-router";
import {
  CalendarCheck,
  Clock,
  SkipForward,
  Timer,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePrefs } from "@/components/app/preferences";
import { PageHeader } from "@/components/app/PageHeader";
import { Segmented } from "@/components/app/Segmented";
import { ActivityHeatmap } from "@/components/app/ActivityHeatmap";
import { addDays, currentTimeZone, defaultWeekStartsOn, normalizeWeekStartsOn } from "@/lib/dates";
import { formatDate, formatNumber } from "@/lib/i18n";
import {
  focusMinutesByDay,
  habitConsistencyByDay,
  insightsReport,
  monthOverMonth,
  taskCompletionsByDay,
  timeAllocation,
  weekdayFocus,
  weeklyReview,
  type DayAllocation,
  type DayPoint,
  type InsightsReport,
  type Observation,
} from "@/lib/insights";


import { tasks as taskApi, todayLocal, useStore } from "@/lib/store";
import { toast } from "sonner";
import { OUTLINE_BTN } from "@/components/ui/button";

export const Route = createLazyFileRoute("/insights")({
  component: InsightsPage,
});

interface ChartDatum {
  tick: string;
  day: string;
  value: number | null;
}

/** {placeholder} substitution for the i18n templates. */
function fill(tpl: string, params: Record<string, string>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(params)) out = out.split("{" + k + "}").join(v);
  return out;
}

function InsightsPage() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const tasks = useStore((s) => s.tasks);
  const habits = useStore((s) => s.habits);
  const habitLogs = useStore((s) => s.habitLogs);
  const focusSessions = useStore((s) => s.focusSessions);
  const xpLedger = useStore((s) => s.xpLedger);
  const dayStartHour = useStore((s) => s.settings.dayStartHour);
  const savedWeekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const weekStartsOn = normalizeWeekStartsOn(savedWeekStartsOn, defaultWeekStartsOn(locale));
  const targetMinutes = useStore((s) => s.settings.dailyFocusTargetMinutes);
  const [range, setRange] = useState<"weekly" | "monthly">("weekly");

  if (!ready) return <InsightsSkeleton />;

  const rtl = locale === "ar";
  const today = todayLocal();
  const tz = currentTimeZone();
  const days = range === "weekly" ? 7 : 30;
  const report = insightsReport({
    tasks,
    habits,
    habitLogs,
    focusSessions,
    xpLedger,
    today,
    timeZone: tz,
    dayStartHour,
  });

  const taskSeries = taskCompletionsByDay(tasks, { today, days, dayStartHour, timeZone: tz });
  const habitSeries = habitConsistencyByDay(habits, habitLogs, { today, days });
  const focusSeries = focusMinutesByDay(focusSessions, { today, days });
  const allocationSeries = timeAllocation(tasks, focusSessions, { today, days });

  const totalOf = (s: DayPoint[]) => s.reduce((sum, p) => sum + (p.value ?? 0), 0);
  const taskTotal = totalOf(taskSeries);
  const focusTotal = totalOf(focusSeries);
  const habitValues = habitSeries.filter((p) => p.value !== null).map((p) => p.value as number);
  const habitAvg = habitValues.length
    ? Math.round(habitValues.reduce((a, b) => a + b, 0) / habitValues.length)
    : 0;

  const dataOf = (series: DayPoint[]): ChartDatum[] =>
    series.map((p) => ({
      tick:
        range === "weekly"
          ? formatDate(locale, new Date(p.day + "T12:00:00Z"), { weekday: "short" })
          : formatDate(locale, new Date(p.day + "T12:00:00Z"), { day: "numeric" }),
      day: p.day,
      value: p.value,
    }));

  const tooltipStyle = {
    backgroundColor: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "0.5rem",
    fontSize: "0.75rem",
    color: "var(--color-foreground)",
  };
  const dayOfPayload = (payload: unknown): string => {
    const rows = payload as { payload?: { day?: string } }[] | undefined;
    return rows?.[0]?.payload?.day ?? "";
  };
  const labelFormatter = (_label: unknown, payload: unknown) => {
    const day = dayOfPayload(payload);
    return day ? formatDate(locale, new Date(day + "T12:00:00Z"), { dateStyle: "medium" }) : "";
  };
  const valueFormatter = (unit: string) => (value: unknown) =>
    formatNumber(locale, Number(value)) + " " + unit;
  const axisTick = { fill: "var(--color-muted-foreground)", fontSize: 11 };
  const gridProps = {
    stroke: "var(--color-border)",
    strokeOpacity: 0.6,
    strokeDasharray: "3 3",
    vertical: false,
  };

  return (
    <section>
      <PageHeader title={t.pages.insights.title} lede={t.pages.insights.body} />

      {!report.hasAnyData ? (
        <EmptyInsights />
      ) : (
        <>
          <div className="mt-6">
            <Segmented
              label={t.nav.insights}
              value={range}
              onChange={(v) => setRange(v === "monthly" ? "monthly" : "weekly")}
              options={[
                { value: "weekly", label: t.ins.weekly },
                { value: "monthly", label: t.ins.monthly },
              ]}
            />
          </div>

          <ReviewPanel />

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartShell
              hue="primary"
              title={t.ins.charts.tasksTitle}
              summary={fill(t.ins.charts.tasksSummary, {
                total: formatNumber(locale, taskTotal),
              })}
              empty={taskTotal === 0}
              emptyMsg={t.ins.charts.emptyRange}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dataOf(taskSeries)}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis
                    dataKey="tick"
                    reversed={rtl}
                    tickLine={false}
                    interval={days > 7 ? 3 : 0}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tick={axisTick}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={48}
                    tickMargin={4}
                    orientation={rtl ? "right" : "left"}
                    tickLine={false}
                    axisLine={false}
                    tick={axisTick}
                    tickFormatter={(v) => formatNumber(locale, Number(v))}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-accent)", opacity: 0.2 }}
                    contentStyle={tooltipStyle}
                    labelFormatter={labelFormatter}
                    formatter={valueFormatter(t.ins.charts.tasksUnit)}
                  />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartShell>

            <ChartShell
              hue="success"
              title={t.ins.charts.habitTitle}
              summary={fill(t.ins.charts.habitSummary, {
                avg: formatNumber(locale, habitAvg),
              })}
              empty={habitValues.length === 0}
              emptyMsg={t.ins.charts.emptyRange}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={dataOf(habitSeries)}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis
                    dataKey="tick"
                    reversed={rtl}
                    tickLine={false}
                    interval={days > 7 ? 3 : 0}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tick={axisTick}
                  />
                  <YAxis
                    domain={[0, 100]}
                    allowDecimals={false}
                    width={48}
                    tickMargin={4}
                    orientation={rtl ? "right" : "left"}
                    tickLine={false}
                    axisLine={false}
                    tick={axisTick}
                    tickFormatter={(v) => formatNumber(locale, Number(v))}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={labelFormatter}
                    formatter={valueFormatter(t.ins.charts.habitUnit)}
                  />
                  <Line
                    dataKey="value"
                    type="monotone"
                    connectNulls
                    dot={false}
                    strokeWidth={2}
                    stroke="var(--color-success)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartShell>

            <ChartShell
              hue="info"
              title={t.ins.charts.focusTitle}
              summary={fill(t.ins.charts.focusSummary, {
                total: formatNumber(locale, focusTotal),
                target: formatNumber(locale, targetMinutes),
              })}
              empty={focusTotal === 0}
              emptyMsg={t.ins.charts.emptyRange}
              wide
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dataOf(focusSeries)}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis
                    dataKey="tick"
                    reversed={rtl}
                    tickLine={false}
                    interval={days > 7 ? 3 : 0}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tick={axisTick}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={48}
                    tickMargin={4}
                    orientation={rtl ? "right" : "left"}
                    tickLine={false}
                    axisLine={false}
                    tick={axisTick}
                    tickFormatter={(v) => formatNumber(locale, Number(v))}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-accent)", opacity: 0.2 }}
                    contentStyle={tooltipStyle}
                    labelFormatter={labelFormatter}
                    formatter={valueFormatter(t.ins.charts.focusUnit)}
                  />
                  <ReferenceLine
                    y={targetMinutes}
                    stroke="var(--color-muted-foreground)"
                    strokeDasharray="4 4"
                    label={{
                      value: fill(t.ins.charts.targetLabel, {
                        n: formatNumber(locale, targetMinutes),
                      }),
                      position: rtl ? "insideTopLeft" : "insideTopRight",
                      fontSize: 10,
                      fill: "var(--color-muted-foreground)",
                    }}
                  />
                  <Bar dataKey="value" fill="var(--color-info)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartShell>
          </div>
        </>
      )}

      <AggregatePanels />

      <TimeAllocationPanel allocation={allocationSeries} />
      <ActivityHeatmap
        tasks={tasks}
        habits={habits}
        habitLogs={habitLogs}
        focusSessions={focusSessions}
        today={today}
        weekStartsOn={weekStartsOn}
        dayStartHour={dayStartHour}
        timeZone={tz}
      />

      <ObservationsPanel report={report} />
    </section>
  );
}

function ChartShell({
  title,
  summary,
  empty,
  emptyMsg,
  wide,
  hue,
  children,
}: {
  title: string;
  summary: string;
  empty: boolean;
  emptyMsg: string;
  wide?: boolean;
  /** Series hue token — the header dot matches the chart fill. */
  hue?: "primary" | "success" | "info";
  children: ReactNode;
}) {
  return (
    <div className={"panel" + (wide ? " xl:col-span-2" : "")}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {hue && <span className={"size-2.5 shrink-0 rounded-full bg-" + hue} aria-hidden />}
        {title}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
      {empty ? (
        <p className="mt-12 text-center text-sm text-muted-foreground">{emptyMsg}</p>
      ) : (
        <div className="mt-3 h-56" role="img" aria-label={title + " — " + summary}>
          {children}
        </div>
      )}
    </div>
  );
}

function EmptyInsights() {
  const { t } = usePrefs();
  return (
    <div className="panel mt-6 p-8 text-center">
      <p className="text-sm font-semibold">{t.ins.empty.title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{t.ins.empty.body}</p>
      {import.meta.env.DEV ? (
        <p className="mx-auto mt-2 max-w-sm text-xs text-muted-foreground">{t.ins.empty.seed}</p>
      ) : null}
    </div>
  );
}

function ObservationsPanel({ report }: { report: InsightsReport }) {
  const { t } = usePrefs();
  return (
    <div className="panel mt-4 p-4">
      <h2 className="text-sm font-semibold">{t.ins.obs.title}</h2>
      {report.observations.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t.ins.obs.insufficient}</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {report.observations.map((o) => (
            <ObservationCard key={o.id} obs={o} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ObservationCard({ obs }: { obs: Observation }) {
  const { t, locale } = usePrefs();
  const nums = {
    events: formatNumber(locale, obs.events),
    activeDays: formatNumber(locale, obs.activeDays),
  };
  let title = "";
  let basis = "";
  let Icon: LucideIcon = Clock;
  if (obs.id === "taskTimeOfDay") {
    const bucketMsg =
      obs.params["bucket"] === "morning"
        ? t.ins.obs.morning
        : obs.params["bucket"] === "afternoon"
          ? t.ins.obs.afternoon
          : t.ins.obs.evening;
    title = fill(bucketMsg, { pct: formatNumber(locale, Number(obs.params["pct"])) });
    basis = fill(t.ins.obs.basisTasks, nums);
  } else if (obs.id === "focusWeekday") {
    const weekdayName = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
      weekday: "long",
    }).format(new Date(Date.UTC(2023, 0, 1 + Number(obs.params["weekday"]))));
    title = fill(t.ins.obs.focusDay, { weekday: weekdayName });
    basis = fill(t.ins.obs.basisFocus, nums);
    Icon = Timer;
  } else {
    title = fill(t.ins.obs.skippedHabit, { habit: obs.params["habit"] ?? "" });
    basis = fill(t.ins.obs.basisSkips, nums);
    Icon = SkipForward;
  }
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border p-3">
      <span className="mt-0.5 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div>
        <p className="text-sm">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{basis}</p>
      </div>
    </li>
  );
}

function InsightsSkeleton() {
  return (
    <section aria-busy="true">
      <div className="mb-2 h-4 w-14 skeleton" />
      <div className="h-9 w-64 max-w-full skeleton" />
      <div className="mt-3 h-4 w-80 max-w-full skeleton" />
      <div className="mt-6 h-10 w-52 skeleton" />
      <div className="mt-4 h-64 skeleton rounded-xl" />
      <div className="mt-4 h-64 skeleton rounded-xl" />
    </section>
  );
}

/* ---------------- weekly review ritual ---------------- */

function ReviewPanel() {
  const { t, locale } = usePrefs();
  const tasks = useStore((s) => s.tasks);
  const habits = useStore((s) => s.habits);
  const habitLogs = useStore((s) => s.habitLogs);
  const focusSessions = useStore((s) => s.focusSessions);
  const xpLedger = useStore((s) => s.xpLedger);
  const savedWeekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const weekStartsOn = normalizeWeekStartsOn(savedWeekStartsOn, defaultWeekStartsOn(locale));
  const dayStartHour = useStore((s) => s.settings.dayStartHour);
  const review = weeklyReview({
    tasks,
    habits,
    habitLogs,
    focusSessions,
    xpLedger,
    today: todayLocal(),
    weekStartsOn,
    dayStartHour,
    timeZone: currentTimeZone(),
  });
  const nextWeekStart = addDays(review.weekStart, 7);
  const carry = (id: string, prevDue: string | undefined) => {
    taskApi.update(id, { dueDate: nextWeekStart });
    toast(t.review.carried, {
      action: { label: t.shop.undo, onClick: () => taskApi.update(id, { dueDate: prevDue }) },
    });
  };
  const rows: { key: "tasks" | "focus" | "habits" | "xp"; now: number; prev: number }[] = [
    { key: "tasks", now: review.current.tasksDone, prev: review.previous.tasksDone },
    { key: "focus", now: review.current.focusMinutes, prev: review.previous.focusMinutes },
    { key: "habits", now: review.current.habitDone, prev: review.previous.habitDone },
    { key: "xp", now: review.current.xp, prev: review.previous.xp },
  ];
  return (
    <div className="panel mt-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="panel-title flex items-center gap-2 p-0 text-sm">
          <CalendarCheck className="size-4 text-primary" aria-hidden />
          {t.review.title}
        </h2>
        <span className="chip tabular-nums">
          {formatDate(locale, new Date(review.weekStart + "T12:00:00Z"), { dateStyle: "medium" })}
          {" — "}
          {formatDate(locale, new Date(review.weekEnd + "T12:00:00Z"), { dateStyle: "medium" })}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map((r) => {
          const up = r.now >= r.prev;
          return (
            <div key={r.key} className="rounded-lg border border-border bg-background/60 p-3">
              <p className="font-display text-2xl font-semibold tabular-nums">
                {formatNumber(locale, r.now)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.review[r.key]}</p>
              <p
                className={
                  "mt-1 flex items-center gap-1 text-xs tabular-nums " +
                  (up ? "text-success" : "text-warning")
                }
              >
                {up ? (
                  <TrendingUp className="size-3" aria-hidden />
                ) : (
                  <TrendingDown className="size-3" aria-hidden />
                )}
                {t.review.lastWeek + ": " + formatNumber(locale, r.prev)}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t.review.carry}</h3>
          {review.carryOver.length > 1 && (
            <button
              type="button"
              onClick={() => {
                for (const c of review.carryOver) taskApi.update(c.id, { dueDate: nextWeekStart });
                toast(t.review.carried);
              }}
              className={OUTLINE_BTN + " px-3 py-1.5"}
            >
              {t.review.carryAll}
            </button>
          )}
        </div>
        {review.carryOver.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t.review.carryEmpty}</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {review.carryOver.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-background/60 p-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {c.dueDate
                    ? formatDate(locale, new Date(c.dueDate + "T12:00:00Z"), {
                        dateStyle: "medium",
                      })
                    : ""}
                </span>
                <button
                  type="button"
                  onClick={() => carry(c.id, c.dueDate)}
                  className={OUTLINE_BTN + " px-2.5 py-1 text-xs"}
                >
                  {t.review.carry}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------- weekday + month aggregates ---------------- */

function AggregatePanels() {
  const { t, locale } = usePrefs();
  const focusSessions = useStore((s) => s.focusSessions);
  const today = todayLocal();
  const weekdays = weekdayFocus(focusSessions, today);
  const maxAvg = Math.max(1, ...weekdays.map((w) => w.avgMinutes));
  const mom = monthOverMonth(focusSessions, today);
  const hasWeekday = weekdays.some((w) => w.sessions > 0);
  const dayLabel = (wd: number) =>
    formatDate(locale, new Date(Date.UTC(2023, 0, 1 + wd)), { weekday: "long" });
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="panel p-4">
        <h2 className="panel-title p-0 text-sm">{t.review.weekdayTitle}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t.review.weekdaySummary}</p>
        {!hasWeekday ? (
          <p className="mt-3 text-sm text-muted-foreground">{t.review.weekdayEmpty}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {weekdays.map((w) => (
              <li key={w.weekday} className="flex items-center gap-2 text-sm">
                <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">
                  {dayLabel(w.weekday)}
                </span>
                <span className="meter h-2 flex-1">
                  <span
                    className="meter-fill block"
                    style={{ width: Math.round((w.avgMinutes / maxAvg) * 100) + "%" }}
                  />
                </span>
                <span className="w-14 shrink-0 text-end text-xs tabular-nums">
                  {formatNumber(locale, w.avgMinutes) + " " + t.focus.minutes}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="panel p-4">
        <h2 className="panel-title p-0 text-sm">{t.review.momTitle}</h2>
        {mom === null ? (
          <p className="mt-3 text-sm text-muted-foreground">{t.review.momFloor}</p>
        ) : (
          <div className="mt-3">
            <p className="font-display text-3xl font-semibold tabular-nums">
              {formatNumber(locale, mom.thisMinutes)}
              <span className="text-base font-normal text-muted-foreground">
                {" " + t.focus.minutes}
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {t.review.momSummary
                .replace("{this}", formatNumber(locale, mom.thisMinutes))
                .replace("{last}", formatNumber(locale, mom.lastMinutes))}
            </p>
            <p
              className={
                "mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums " +
                (mom.deltaPct >= 0 ? "bg-success/15 text-success" : "bg-warning/15 text-warning")
              }
            >
              {mom.deltaPct >= 0 ? (
                <TrendingUp className="size-3" aria-hidden />
              ) : (
                <TrendingDown className="size-3" aria-hidden />
              )}
              {t.review.momDelta.replace("{n}", formatNumber(locale, Math.abs(mom.deltaPct)))}
            </p>
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              {formatNumber(locale, mom.thisActiveDays) +
                " / " +
                formatNumber(locale, mom.lastActiveDays)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


/* ---------------- time allocation panel ---------------- */

function TimeAllocationPanel({ allocation }: { allocation: DayAllocation[] }) {
  const { t, locale } = usePrefs();
  const totalFocus = allocation.reduce((sum, d) => sum + d.focusMinutes, 0);
  const totalTasks = allocation.reduce((sum, d) => sum + d.tasksDone, 0);
  const hasData = totalFocus > 0 || totalTasks > 0;

  return (
    <div className="panel mt-4 p-4">
      <h2 className="panel-title p-0 text-sm">{t.review.title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t.review.timeAllocationHint}</p>
      {!hasData ? (
        <p className="mt-3 text-sm text-muted-foreground">{t.review.timeAllocationEmpty}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {allocation.map((d) => (
            <div key={d.day} className="flex items-center gap-2 text-sm">
              <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">
                {formatDate(locale, new Date(d.day + "T12:00:00Z"), { weekday: "short" })}
              </span>
              <span className="flex-1 h-2 meter">
                <span
                  className="meter-fill block"
                  style={{ width: Math.min(100, d.focusMinutes) + "%" }}
                />
              </span>
              <span className="w-24 shrink-0 text-end text-xs tabular-nums">
                {d.focusMinutes} min ·{d.tasksDone} done
              </span>
            </div>
          ))}
          <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>
              {t.review.focus}: {formatNumber(locale, totalFocus)}
            </span>
            <span>
              {t.review.tasks}: {formatNumber(locale, totalTasks)} done
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t.review.timeAllocationNote}</p>
        </div>
      )}
    </div>
  );
}
