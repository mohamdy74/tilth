import { useEffect, useRef } from "react";
import { type Task, type Habit, type HabitLog, type FocusSession, type LocalDay } from "@/lib/types";
import { activityHeatmap, monthBlocks, HEAT_DAYS } from "@/lib/activityHeatmap";
import { addDays, endOfMonth, startOfMonth } from "@/lib/dates";
import { formatDate, formatNumber } from "@/lib/i18n";
import { plural } from "@/lib/i18n";
import { usePrefs } from "./preferences";
import type { Locale } from "@/lib/i18n";

const CELL = 12; // px
const GAP = 3; // px
const MONTH_GAP = 12; // px
const WEEKDAY_COL = 32; // px
const GRID_HEIGHT = HEAT_DAYS * CELL + (HEAT_DAYS - 1) * GAP; // 102px

/** Level->color mapping copied verbatim from the insights heatmap. */
const levelCls = (level: number): string => {
  switch (level) {
    case 1:
      return "bg-accent/20";
    case 2:
      return "bg-accent/40";
    case 3:
      return "bg-accent/60";
    case 4:
      return "bg-accent/80";
    default:
      return "bg-muted/20";
  }
};

function weekdayLabel(locale: Locale, weekStartsOn: number, j: number): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: "narrow",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2023, 0, 1 + ((weekStartsOn + j) % HEAT_DAYS))));
}

function monthLabel(locale: Locale, day: LocalDay): string {
  return formatDate(locale, new Date(day + "T12:00:00Z"), { month: "short", timeZone: "UTC" });
}

export interface ActivityHeatmapProps {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  focusSessions: FocusSession[];
  today: LocalDay;
  weekStartsOn: number;
  dayStartHour: number;
  timeZone: string;
}

/** 12-month activity heatmap (replaces the 52-week grid in HeatmapPanel). */
export function ActivityHeatmap({
  tasks,
  habits,
  habitLogs,
  focusSessions,
  today,
  weekStartsOn,
  dayStartHour,
  timeZone,
}: ActivityHeatmapProps) {
  const { t, locale } = usePrefs();
  const safeWeekStartsOn =
    Number.isInteger(weekStartsOn) && weekStartsOn >= 0 && weekStartsOn < HEAT_DAYS
      ? weekStartsOn
      : 0;

  const heatmap = activityHeatmap(
    tasks,
    habits,
    habitLogs,
    focusSessions,
    { today, weekStartsOn: safeWeekStartsOn, dayStartHour, timeZone },
  );
  const blocks = monthBlocks(heatmap, today, safeWeekStartsOn);

  const totalActivities = heatmap.reduce((sum, c) => sum + c.count, 0);
  const activeDays = heatmap.filter((c) => c.count > 0).length;
  const summary = fill(t.heatmap.summary, {
    total: formatNumber(locale, totalActivities),
    days: formatNumber(locale, activeDays),
  });

  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const el = document.documentElement;
      el.scrollLeft = el.scrollWidth;
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleCellKeyDown = (e: React.KeyboardEvent, dayKey: LocalDay) => {
    let target: LocalDay | null = null;
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        target = addDays(dayKey, -1);
        break;
      case "ArrowDown":
        e.preventDefault();
        target = addDays(dayKey, 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        target = e.shiftKey ? addDays(dayKey, -7) : addDays(dayKey, -1);
        break;
      case "ArrowRight":
        e.preventDefault();
        target = e.shiftKey ? addDays(dayKey, 7) : addDays(dayKey, 1);
        break;
      case "Home":
        e.preventDefault();
        target = startOfMonth(dayKey);
        break;
      case "End":
        e.preventDefault();
        target = endOfMonth(dayKey);
        break;
    }
    if (target) {
      const el = document.querySelector(
        `[data-hm-cell][data-day="${CSS.escape(target)}"]`,
      ) as HTMLElement | null;
      el?.focus();
    }
  };

  return (
    <section className="panel mt-4 p-4" data-hm-root>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-primary" aria-hidden>
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v1" />
            </svg>
          </span>
          <h2 className="text-sm font-semibold">{t.heatmap.title}</h2>
        </div>
        <span className="text-xs font-semibold text-muted-foreground tabular-nums">
          {formatNumber(locale, totalActivities)} {t.heatmap.activities}
        </span>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">{t.heatmap.subtitle}</p>
      <p className="mt-2 text-sm font-medium tabular-nums" aria-live="polite">
        {summary}
      </p>

      <div className="overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        <div className={clsx("inline-flex gap-[", MONTH_GAP, "px]")}>
          {blocks.map((block, bi) => {
            const blockWidth = block.cols * CELL + (block.cols - 1) * GAP;
            return (
              <div
                key={block.year + "-" + block.month}
                ref={(el) => {
                  blockRefs.current[bi] = el;
                }}
                className="inline-block"
              >
                <div className="mb-2 flex items-center gap-1 text-[9px] text-muted-foreground">
                  {monthLabel(
                    locale,
                    block.cells[0]?.day ?? `${block.year}-${String(block.month).padStart(2, "0")}-01`,
                  )}
                  <span className="text-[9px]">{block.year}</span>
                </div>
                <div
                  className="grid grid-cols-7 gap-3 w-fit min-w-[calc(32px+1px)]"
                  data-hm-block
                  data-cols={block.cols}
                  style={{
                    width: blockWidth + "px",
                    height: GRID_HEIGHT + "px",
                  }}
                >
                  {/* Weekday label column on the left, rows 2, 4, 6 */}
                  {[...Array(HEAT_DAYS)].map((_, j) => {
                    const showLabel = j === 1 || j === 3 || j === 5;
                    return (
                      <span
                        key={"wd-" + j}
                        className={
                          "size-12 shrink-0 text-[9px] leading-none text-muted-foreground flex items-center justify-center " +
                          (showLabel ? "" : "opacity-0")
                        }
                        style={{
                          gridColumn: "1",
                          gridRow: j + 1,
                          width: WEEKDAY_COL + "px",
                          position: showLabel ? "sticky" : "static",
                          left: 0,
                          zIndex: showLabel ? 1 : 0,
                        }}
                      >
                        {showLabel ? weekdayLabel(locale, safeWeekStartsOn, j) : ""}
                      </span>
                    );
                  })}
                  {block.cells.map((c) => {
                    const isToday = c.day === today;
                    const dateLabel = formatDate(locale, new Date(c.day + "T12:00:00Z"), {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    });
                    const countLabel = plural(locale, t.heatmap.activityCount, c.count);
                    const disabled = !c.isPast;
                    return (
                      <button
                        key={c.day}
                        type="button"
                        data-hm-cell
                        data-day={c.day}
                        aria-label={
                          dateLabel +
                          " — " +
                          countLabel +
                          (isToday ? " — " + t.heatmap.today : "")
                        }
                        title={
                          dateLabel +
                          " — " +
                          countLabel +
                          (isToday ? " — " + t.heatmap.today : "")
                        }
                        disabled={disabled}
                        onKeyDown={(e) => handleCellKeyDown(e, c.day)}
                        className={
                          clsx(
                            "size-12 shrink-0 rounded-[2px] border-0 outline-none",
                            levelCls(c.level),
                            isToday
                              ? "shadow-[0_0_0_1px_var(--color-accent)]"
                              : "",
                            disabled ? "opacity-30 cursor-not-allowed" : "hover:opacity-80",
                          )
                        }
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[2px] shadow-[0_0_0_1px_var(--color-accent)]" aria-hidden="true" />
          {t.heatmap.today}
        </span>
        <div className="flex items-center gap-1.5 text-right" aria-label={t.heatmap.less + " — " + t.heatmap.more}>
          <span>{t.heatmap.less}</span>
          {[0, 1, 2, 3, 4].map((lvl) => (
            <span key={lvl} className="inline-flex items-center gap-1">
              <span className={"w-3 h-3 rounded-[2px] " + levelCls(lvl)} />
              {lvl === 0 ? t.heatmap.zero : formatNumber(locale, levelMin(lvl))}
              {lvl === 4 ? "+" : lvl > 0 ? "-" + formatNumber(locale, levelMax(lvl)) : ""}
            </span>
          ))}
          <span>{t.heatmap.more}</span>
        </div>
      </div>
    </section>
  );
}

function levelMin(level: number): number {
  switch (level) {
    case 1:
      return 1;
    case 2:
      return 3;
    case 3:
      return 6;
    case 4:
      return 10;
    default:
      return 0;
  }
}

function levelMax(level: number): number {
  switch (level) {
    case 1:
      return 2;
    case 2:
      return 5;
    case 3:
      return 9;
    default:
      return 999;
  }
}

/** {placeholder} substitution for the i18n templates. */
function fill(tpl: string, params: Record<string, string>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(params)) out = out.split("{" + k + "}").join(v);
  return out;
}

function clsx(...classes: (string | number | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
