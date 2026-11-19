import { useMemo, useState } from "react";
import {
  type Task,
  type Habit,
  type HabitLog,
  type FocusSession,
  type LocalDay,
} from "@/lib/types";
import { activityCounts, activityLevel } from "@/lib/activityHeatmap";
import {
  HEAT_CELL,
  HEAT_GAP,
  HEAT_RADIUS,
  HEAT_WEEKDAY_COL,
  HEAT_LABEL_GAP,
  HEAT_LEGEND_CELL,
  HEAT_DAYS,
} from "@/lib/layoutConstants";
import { addDays, daysInMonth } from "@/lib/dates";
import { formatDate } from "@/lib/i18n";
import { plural } from "@/lib/i18n";
import { usePrefs } from "./preferences";
import type { Locale } from "@/lib/i18n";

const GRID_HEIGHT = HEAT_DAYS * HEAT_CELL + (HEAT_DAYS - 1) * HEAT_GAP; // 232px

/** Level->color mapping: level 0 = transparent (outline only), levels 1-4 =
 * accent token mixed over the card background (via --hm-* vars in styles.css). */
const levelVar = (level: number): string => {
  return level >= 1 ? `var(--hm-l${Math.min(level, 4)})` : "transparent";
};

function weekdayLabel(locale: Locale, weekStartsOn: number, j: number): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: "narrow",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2023, 0, 1 + ((weekStartsOn + j) % HEAT_DAYS))));
}

/** Continuous month keys from `today` back to the earliest local day with
 * activity (or just today if no data), newest first, no future months. */
function monthOptions(today: LocalDay, counts: Map<LocalDay, number>): string[] {
  const current = today.slice(0, 7);
  let earliest = current;
  for (const day of counts.keys()) {
    const m = day.slice(0, 7);
    if (m < earliest) earliest = m;
  }
  const out: string[] = [];
  let cursor = current;
  while (cursor >= earliest) {
    out.push(cursor);
    const parts = cursor.split("-");
    const y = Number(parts[0]!);
    const m = Number(parts[1]!);
    let prevY = y;
    let prevM = m - 1;
    if (prevM < 1) {
      prevM = 12;
      prevY = y - 1;
    }
    cursor = prevY + "-" + String(prevM).padStart(2, "0");
  }
  return out;
}

/** Month name + year label for a "YYYY-MM" key, using the app's locale. */
function monthYearLabel(locale: Locale, key: string): string {
  const parts = key.split("-");
  const y = Number(parts[0]!);
  const m = Number(parts[1]!);
  return formatDate(locale, new Date(y, m - 1, 1), {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Pure keyboard navigation for the single-month grid. Returns the next
 * day key, clamped to the month's first day and last non-future day;
 * never enters a future day. */
export function nextFocusDay(
  dayKey: LocalDay,
  key: string,
  today: LocalDay,
  daysInMonthCount: number,
): LocalDay | null {
  const parts = dayKey.split("-");
  const y = Number(parts[0]!);
  const m = Number(parts[1]!);
  const startD = Number(parts[2]!); // starting day number
  let d = startD;
  const tParts = today.split("-");
  const td = Number(tParts[2]!); // today's day number = last non-future day
  switch (key) {
    case "ArrowUp":
      d -= 1;
      if (d < 1) d = 1; // clamp at month start
      break;
    case "ArrowDown":
      d += 1;
      if (d > td) d = td; // clamp at today (last non-future day)
      break;
    case "ArrowLeft":
      d -= 7;
      if (d < 1) d = 1;
      break;
    case "ArrowRight":
      d += 7;
      if (d > daysInMonthCount) d = daysInMonthCount; // clamp at month end
      if (startD >= td && d > td) d = td; // from today/future, clamp at today
      break;
    case "Home":
      d = 1;
      break;
    case "End":
      d = td; // go to today (last non-future day)
      break;
    default:
      return null;
  }
  if (d > daysInMonthCount) d = daysInMonthCount;
  if (d < 1) d = 1;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
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

/** Single-month activity heatmap (replaces the 52-week grid in HeatmapPanel). */
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

  // Per-day counts over ALL history (no 364-day slice), built once.
  const counts = useMemo(
    () =>
      activityCounts(tasks, habits, habitLogs, focusSessions, {
        dayStartHour,
        timeZone,
      }),
    [tasks, habits, habitLogs, focusSessions, dayStartHour, timeZone],
  );

  // Month options derived from today + data; no persistence.
  const options = useMemo(() => monthOptions(today, counts), [counts, today]);
  const currentKey = today.slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    options.includes(currentKey) ? currentKey : options[0] ?? currentKey,
  );
  if (!options.includes(selectedMonth)) {
    setSelectedMonth(currentKey);
  }

  // Cells for the selected month (all days drawn, including future).
  const smParts = selectedMonth.split("-");
  const sy = Number(smParts[0]!);
  const sm = Number(smParts[1]!);
  const firstDayOfMonth = `${sy}-${String(sm).padStart(2, "0")}-01`;
  const dim = daysInMonth(firstDayOfMonth);
  // UTC day of the 1st — never mix a local Date with getUTCDay (tz bug).
  const weekdayIndexOfFirst = new Date(Date.UTC(sy, sm - 1, 1)).getUTCDay();
  const offset = (weekdayIndexOfFirst - safeWeekStartsOn + 7) % 7;
  const cols = Math.ceil((offset + dim) / 7);
  const blockWidth = cols * HEAT_CELL + (cols - 1) * HEAT_GAP;

  const monthCells = useMemo(() => {
    const cells: Array<{
      day: LocalDay;
      count: number;
      level: number;
      isPast: boolean;
      isFuture: boolean;
    }> = [];
    for (let d = 1; d <= dim; d++) {
      const dayKey = addDays(firstDayOfMonth, d - 1);
      const count = counts.get(dayKey) ?? 0;
      cells.push({
        day: dayKey,
        count,
        level: activityLevel(count),
        isPast: dayKey <= today,
        isFuture: dayKey > today,
      });
    }
    return cells;
  }, [counts, firstDayOfMonth, dim, today]);

  const totalActivities = monthCells.reduce((sum, c) => sum + c.count, 0);
  const activeDays = monthCells.filter((c) => c.count > 0).length;
  const summary = fill(t.heatmap.summaryMonth, {
    total: plural(locale, t.heatmap.activityCount, totalActivities),
    days: plural(locale, t.heatmap.activeDaysCount, activeDays),
    month: monthYearLabel(locale, selectedMonth),
  });

  const handleCellKeyDown = (e: React.KeyboardEvent, dayKey: LocalDay) => {
    const target = nextFocusDay(dayKey, e.key, today, dim);
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
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <span className="text-primary" aria-hidden>
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v1" />
            </svg>
          </span>
          <h2 className="truncate text-sm font-semibold">{t.heatmap.title}</h2>
        </div>
        <select
          id="hm-month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          aria-label={t.heatmap.monthDropdown}
          className="h-8 shrink-0 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground outline-none"
        >
          {options.map((key) => (
            <option key={key} value={key}>
              {monthYearLabel(locale, key)}
            </option>
          ))}
        </select>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{t.heatmap.subtitle}</p>

      {/* Calendar block: fixed LTR geometry (grid placement is explicit, so
          the visual result is identical in both document directions). */}
      <div
        className="flex w-fit items-start"
        data-hm-block
        data-cols={cols}
        dir="ltr"
        style={{ gap: HEAT_LABEL_GAP + "px" }}
      >
        {/* Weekday label column, beside — never inside — the cell grid. */}
        <div
          className="flex shrink-0 flex-col"
          style={{ gap: HEAT_GAP + "px", width: HEAT_WEEKDAY_COL + "px" }}
          aria-hidden="true"
        >
          {[...Array(HEAT_DAYS)].map((_, j) => (
            <span
              key={"wd-" + j}
              className="flex items-center justify-end text-[10px] font-medium leading-none text-muted-foreground"
              style={{ height: HEAT_CELL + "px", opacity: j % 2 === 1 ? 1 : 0 }}
            >
              {j % 2 === 1 ? weekdayLabel(locale, safeWeekStartsOn, j) : ""}
            </span>
          ))}
        </div>
        <div
          className="grid"
          data-hm-grid
          style={{
            gridTemplateColumns: `repeat(${cols}, ${HEAT_CELL}px)`,
            gridTemplateRows: `repeat(${HEAT_DAYS}, ${HEAT_CELL}px)`,
            gridAutoFlow: "column",
            gap: HEAT_GAP + "px",
            width: blockWidth + "px",
            height: GRID_HEIGHT + "px",
          }}
        >
          {monthCells.map((c) => {
            const dayIndex = offset + Number(c.day.slice(8, 10)) - 1;
            const row = (dayIndex % HEAT_DAYS) + 1;
            const col = Math.floor(dayIndex / HEAT_DAYS) + 1;
            const isToday = c.day === today;
            const dateLabel = formatDate(locale, new Date(c.day + "T12:00:00Z"), {
              dateStyle: "medium",
              timeZone: "UTC",
            });
            const countLabel = plural(locale, t.heatmap.activityCount, c.count);
            const isInteractive = !c.isFuture;
            return (
              <button
                key={c.day}
                type="button"
                data-hm-cell
                data-day={c.day}
                aria-label={
                  dateLabel + " — " + countLabel + (isToday ? " — " + t.heatmap.today : "")
                }
                title={
                  dateLabel + " — " + countLabel + (isToday ? " — " + t.heatmap.today : "")
                }
                disabled={!isInteractive}
                aria-hidden={c.isFuture ? "true" : undefined}
                tabIndex={isInteractive ? 0 : -1}
                onKeyDown={(e) => handleCellKeyDown(e, c.day)}
                style={{
                  width: HEAT_CELL + "px",
                  height: HEAT_CELL + "px",
                  borderRadius: HEAT_RADIUS + "px",
                  gridColumn: String(col),
                  gridRow: String(row),
                  backgroundColor: levelVar(c.level),
                  boxShadow: isToday
                    ? "0 0 0 2px var(--color-accent), inset 0 0 0 1px var(--hm-outline)"
                    : "inset 0 0 0 1px var(--hm-outline)",
                }}
                className={
                  "shrink-0 border-0 outline-none transition-colors " +
                  (c.isFuture
                    ? "cursor-not-allowed opacity-35"
                    : "cursor-pointer hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-0")
                }
              />
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-sm font-medium tabular-nums" aria-live="polite">
        {summary}
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            style={{
              width: HEAT_LEGEND_CELL + "px",
              height: HEAT_LEGEND_CELL + "px",
              borderRadius: HEAT_RADIUS + "px",
              backgroundColor: "var(--color-card)",
              boxShadow:
                "0 0 0 2px var(--color-accent), inset 0 0 0 1px var(--hm-outline)",
            }}
          />
          {t.heatmap.today}
        </span>
        <div
          className="flex items-center gap-1.5"
          aria-label={t.heatmap.less + " — " + t.heatmap.more}
        >
          <span>{t.heatmap.less}</span>
          {[0, 1, 2, 3, 4].map((lvl) => (
            <span
              key={lvl}
              aria-hidden="true"
              style={{
                width: HEAT_LEGEND_CELL + "px",
                height: HEAT_LEGEND_CELL + "px",
                borderRadius: HEAT_RADIUS + "px",
                backgroundColor: levelVar(lvl),
                boxShadow: "inset 0 0 0 1px var(--hm-outline)",
              }}
            />
          ))}
          <span>{t.heatmap.more}</span>
        </div>
      </div>
    </section>
  );
}

/** {placeholder} substitution for the i18n templates. */
function fill(tpl: string, params: Record<string, string>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(params)) out = out.split("{" + k + "}").join(v);
  return out;
}
