import { useMemo, useState } from "react";
import {
  type Task,
  type Habit,
  type HabitLog,
  type FocusSession,
  type LocalDay,
} from "@/lib/types";
import {
  activityCounts,
  HEAT_DAYS,
  monthBlocks,
  monthOptions,
  nextFocusDay,
} from "@/lib/activityHeatmap";
import {
  HEAT_CELL,
  HEAT_GAP,
  HEAT_RADIUS,
  HEAT_WEEKDAY_ROW_H,
  HEAT_WEEKDAY_GAP,
  HEAT_LEGEND_CELL,
  HEAT_LEGEND_RADIUS,
  HEAT_LEGEND_GAP,
} from "@/lib/layoutConstants";
import { startOfMonth } from "@/lib/dates";
import { formatDate, plural } from "@/lib/i18n";
import { usePrefs } from "./preferences";
import type { Locale } from "@/lib/i18n";

const CALENDAR_WIDTH = 7 * HEAT_CELL + 6 * HEAT_GAP;

const tierVar = (value: number): string =>
  value === 2 ? "var(--hm-l2)" : value === 1 ? "var(--hm-l1)" : "transparent";

export function weekdayLabel(locale: Locale, weekStartsOn: number, index: number): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: locale === "ar" ? "narrow" : "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2023, 0, 1 + ((weekStartsOn + index) % HEAT_DAYS))));
}

function monthYearLabel(locale: Locale, key: string): string {
  return formatDate(locale, new Date(key + "-01T12:00:00Z"), {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
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
  const counts = useMemo(
    () =>
      activityCounts(tasks, habits, habitLogs, focusSessions, {
        dayStartHour,
        timeZone,
      }),
    [tasks, habits, habitLogs, focusSessions, dayStartHour, timeZone],
  );
  const options = useMemo(() => monthOptions(today, counts), [counts, today]);
  const currentKey = today.slice(0, 7);
  const [monthChoice, setMonthChoice] = useState(currentKey);
  const selectedMonth = options.includes(monthChoice) ? monthChoice : currentKey;
  const block = useMemo(
    () =>
      monthBlocks(
        counts,
        startOfMonth((selectedMonth + "-01") as LocalDay),
        today,
        safeWeekStartsOn,
      ),
    [counts, selectedMonth, today, safeWeekStartsOn],
  );
  const gridHeight = block.rows * HEAT_CELL + (block.rows - 1) * HEAT_GAP;
  const totalActivities = block.cells.reduce((sum, cell) => sum + cell.count, 0);
  const activeDays = block.cells.filter((cell) => cell.count > 0).length;
  const summary = fill(t.heatmap.summaryMonth, {
    total: plural(locale, t.heatmap.activityCount, totalActivities),
    days: plural(locale, t.heatmap.activeDaysCount, activeDays),
    month: monthYearLabel(locale, selectedMonth),
  });

  const [focusedDay, setFocusedDay] = useState<LocalDay | null>(null);
  const pastCells = block.cells.filter((cell) => cell.isPast);
  const fallbackFocus = block.cells.some((cell) => cell.day === today)
    ? today
    : pastCells[pastCells.length - 1]!.day;
  const rovingDay = pastCells.some((cell) => cell.day === focusedDay) ? focusedDay : fallbackFocus;

  const handleCellKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, day: LocalDay) => {
    const target = nextFocusDay(day, event.key, today, block.cells.length);
    if (!target) return;
    event.preventDefault();
    setFocusedDay(target);
    const root = event.currentTarget.closest("[data-hm-root]");
    root?.querySelector<HTMLElement>(`[data-hm-cell][data-day="${target}"]`)?.focus();
  };

  const legend = [
    { value: 0, label: t.heatmap.legendEmpty },
    { value: 1, label: t.heatmap.legendLight },
    { value: 2, label: t.heatmap.legendSolid },
  ];

  return (
    <section className="panel mt-4 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <span className="text-primary" aria-hidden>
            <svg
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v1" />
            </svg>
          </span>
          <h2 className="truncate text-sm font-semibold">{t.heatmap.title}</h2>
        </div>
        <select
          id="hm-month"
          value={selectedMonth}
          onChange={(event) => {
            setMonthChoice(event.target.value);
            setFocusedDay(null);
          }}
          aria-label={t.heatmap.monthDropdown}
          className="min-h-11 shrink-0 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground"
        >
          {options.map((key) => (
            <option key={key} value={key}>
              {monthYearLabel(locale, key)}
            </option>
          ))}
        </select>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{t.heatmap.subtitle}</p>

      <div data-hm-root dir="ltr">
        <div
          data-hm-weekdays
          aria-hidden="true"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(7, ${HEAT_CELL}px)`,
            columnGap: HEAT_GAP + "px",
            width: CALENDAR_WIDTH + "px",
            height: HEAT_WEEKDAY_ROW_H + "px",
            marginBottom: HEAT_WEEKDAY_GAP + "px",
          }}
        >
          {Array.from({ length: HEAT_DAYS }, (_, index) => (
            <span
              key={index}
              className="font-medium text-muted-foreground"
              style={{
                fontSize: "12px",
                lineHeight: HEAT_WEEKDAY_ROW_H + "px",
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              {weekdayLabel(locale, safeWeekStartsOn, index)}
            </span>
          ))}
        </div>
        <div
          data-hm-block
          data-rows={block.rows}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(7, ${HEAT_CELL}px)`,
            gridTemplateRows: `repeat(${block.rows}, ${HEAT_CELL}px)`,
            gap: HEAT_GAP + "px",
            width: CALENDAR_WIDTH + "px",
            height: gridHeight + "px",
          }}
        >
          {block.cells.map((cell) => {
            const isToday = cell.day === today;
            const shadow = isToday
              ? "0 0 0 2px var(--color-accent), inset 0 0 0 1px var(--hm-outline)"
              : "inset 0 0 0 1px var(--hm-outline)";
            const style = {
              width: HEAT_CELL + "px",
              height: HEAT_CELL + "px",
              borderRadius: HEAT_RADIUS + "px",
              gridColumn: String(cell.col),
              gridRow: String(cell.row),
              backgroundColor: tierVar(cell.tier),
              boxShadow: shadow,
              opacity: cell.isPast ? 1 : 0.4,
            };
            if (!cell.isPast) {
              return (
                <span
                  key={cell.day}
                  data-hm-cell
                  data-day={cell.day}
                  aria-hidden="true"
                  style={style}
                />
              );
            }
            const dateLabel = formatDate(locale, new Date(cell.day + "T12:00:00Z"), {
              dateStyle: "medium",
              timeZone: "UTC",
            });
            const countLabel = plural(locale, t.heatmap.activityCount, cell.count);
            const label = dateLabel + " — " + countLabel + (isToday ? " — " + t.heatmap.today : "");
            return (
              <button
                key={cell.day}
                type="button"
                data-hm-cell
                data-day={cell.day}
                aria-label={label}
                title={label}
                tabIndex={cell.day === rovingDay ? 0 : -1}
                onFocus={() => setFocusedDay(cell.day)}
                onKeyDown={(event) => handleCellKeyDown(event, cell.day)}
                style={style}
                className="cursor-pointer transition-colors hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              />
            );
          })}
        </div>
      </div>

      <div
        data-hm-legend
        className="flex flex-wrap items-center text-xs text-muted-foreground"
        style={{ marginTop: "12px", columnGap: "16px", rowGap: "8px" }}
      >
        {legend.map((item) => (
          <span
            key={item.value}
            className="inline-flex items-center"
            style={{ gap: HEAT_LEGEND_GAP + "px" }}
          >
            <span
              data-hm-tier-swatch
              aria-hidden="true"
              style={{
                width: HEAT_LEGEND_CELL + "px",
                height: HEAT_LEGEND_CELL + "px",
                borderRadius: HEAT_LEGEND_RADIUS + "px",
                backgroundColor: tierVar(item.value),
                boxShadow: "inset 0 0 0 1px var(--hm-outline)",
              }}
            />
            {item.label}
          </span>
        ))}
        <span className="inline-flex items-center" style={{ gap: HEAT_LEGEND_GAP + "px" }}>
          <span
            aria-hidden="true"
            style={{
              width: HEAT_LEGEND_CELL + "px",
              height: HEAT_LEGEND_CELL + "px",
              borderRadius: HEAT_LEGEND_RADIUS + "px",
              backgroundColor: "transparent",
              boxShadow: "0 0 0 2px var(--color-accent), inset 0 0 0 1px var(--hm-outline)",
            }}
          />
          {t.heatmap.today}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium tabular-nums" aria-live="polite">
        {summary}
      </p>
    </section>
  );
}

function fill(template: string, params: Record<string, string>): string {
  let output = template;
  for (const [key, value] of Object.entries(params)) {
    output = output.split("{" + key + "}").join(value);
  }
  return output;
}
