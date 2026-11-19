import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  Check,
  Flame,
  Plus,
  Share2,
  SkipForward,
  Snowflake,
  Sprout,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { usePrefs } from "@/components/app/preferences";
import { Segmented } from "@/components/app/Segmented";
import { Modal } from "@/components/app/Modal";
import { drawShareCard, shareCardDataUrl, type ShareCellKind } from "@/lib/shareCard";
import { PageHeader } from "@/components/app/PageHeader";
import { OUTLINE_BTN, PRIMARY_BTN } from "@/components/ui/button";
import { toast } from "sonner";
import { addDays, startOfWeek } from "@/lib/dates";
import { formatDate, formatNumber, plural, type Locale } from "@/lib/i18n";
import { habits as habitApi, todayLocal, useStore } from "@/lib/store";
import {
  consistency30,
  dayKind,
  habitStreaks,
  isScheduledOn,
  logsByDay,
  type DayKind,
} from "@/lib/streaks";
import type { Habit, HabitLog, HabitSchedule, LocalDay } from "@/lib/types";

export const Route = createFileRoute("/habits")({
  head: () => ({
    meta: [
      { title: "Habits — Tilth" },
      {
        name: "description",
        content: "Build steady habits with flexible schedules and forgiving streaks.",
      },
      { property: "og:title", content: "Habits — Tilth" },
      {
        property: "og:description",
        content: "Build steady habits with flexible schedules and forgiving streaks.",
      },
    ],
  }),
  component: HabitsPage,
});

type TabKey = "today" | "all";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const HEAT_WEEKS = 12;
/** Heatmap past-day logging window (days back). */
const LOG_WINDOW_DAYS = 7;

const KIND_CLS: Record<DayKind, string> = {
  done: "border-primary bg-primary",
  skipped: "border-primary/70 bg-transparent",
  missed: "border-destructive/40 bg-destructive/30",
  upcoming: "border-border bg-accent/40",
  off: "border-border/40 bg-transparent",
  frozen: "border-warning/60 bg-warning/20",
};
const KIND_LEGEND: DayKind[] = ["done", "skipped", "missed", "upcoming", "off", "frozen"];

function HabitsPage() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const allHabits = useStore((s) => s.habits);
  const allLogs = useStore((s) => s.habitLogs);
  const weekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const [tab, setTab] = useState<TabKey>("today");
  const [showNew, setShowNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showNew) nameRef.current?.focus();
  }, [showNew]);

  // The command palette asks for a fresh habit through sessionStorage.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("tilth.new-habit") === "1") {
        window.sessionStorage.removeItem("tilth.new-habit");
        setShowNew(true);
      }
    } catch {
      /* storage unavailable — ignore */
    }
  }, []);

  if (!ready) return <HabitsSkeleton />;

  const today = todayLocal();
  const liveHabits = allHabits.filter((h) => !h.deletedAt);
  const active = liveHabits.filter((h) => !h.archived);
  const archived = liveHabits.filter((h) => h.archived);
  const liveLogs = allLogs.filter((l) => !l.deletedAt);

  const dueToday = active.filter((h) => isScheduledOn(h.schedule, today));
  const todayLog = new Map<string, HabitLog>();
  for (const l of liveLogs) {
    if (l.localDay !== today) continue;
    const prev = todayLog.get(l.habitId);
    if (!prev || l.updatedAt > prev.updatedAt) todayLog.set(l.habitId, l);
  }

  const showToast = (msg: string, undo?: () => void) =>
    toast(msg, undo ? { action: { label: t.habits.toasts.undo, onClick: undo } } : {});

  // One-tap done/skip on today; clicking the current state clears it.
  const toggleToday = (habit: Habit, status: "done" | "skipped") => {
    const cur = todayLog.get(habit.id)?.status;
    if (cur === status) habitApi.unlog(habit.id, today);
    else habitApi.log(habit.id, status, today);
  };

  // Heatmap click cycle for the past logging window: done, then skipped, then clear.
  const cycleDay = (habitId: string, day: LocalDay) => {
    const by = logsByDay(liveLogs.filter((l) => l.habitId === habitId));
    const cur = by.get(day)?.status;
    if (cur === undefined) habitApi.log(habitId, "done", day);
    else if (cur === "done") habitApi.log(habitId, "skipped", day);
    else habitApi.unlog(habitId, day);
  };

  const removeHabit = (habit: Habit) => {
    habitApi.remove(habit.id);
    showToast(t.habits.toasts.deleted, () => habitApi.update(habit.id, { deletedAt: undefined }));
  };

  const archiveHabit = (habit: Habit) => {
    habitApi.update(habit.id, { archived: true });
    showToast(t.habits.toasts.archived, () => habitApi.update(habit.id, { archived: false }));
  };

  return (
    <section>
      <PageHeader
        title={t.pages.habits.title}
        lede={liveHabits.length === 0 ? t.pages.habits.body : undefined}
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label={t.nav.habits}
          value={tab}
          onChange={(v) => setTab(v === "all" ? "all" : "today")}
          options={[
            {
              value: "today",
              label: t.habits.view.today,
              badge: formatNumber(locale, dueToday.length),
            },
            {
              value: "all",
              label: t.habits.view.all,
              badge: formatNumber(locale, active.length),
            },
          ]}
        />
        <button type="button" onClick={() => setShowNew(!showNew)} className={PRIMARY_BTN}>
          <Plus className="size-4" aria-hidden />
          {t.habits.newHabit}
        </button>
      </div>

      {showNew && (
        <NewHabitForm
          weekStartsOn={weekStartsOn}
          nameRef={nameRef}
          onAdd={(name, schedule) => {
            habitApi.add(name, schedule);
            setShowNew(false);
          }}
          onCancel={() => setShowNew(false)}
        />
      )}

      {tab === "today" ? (
        active.length === 0 ? (
          <EmptyState kind="none" onAdd={() => setShowNew(true)} />
        ) : dueToday.length === 0 ? (
          <EmptyState kind="today" onAdd={() => setShowNew(true)} />
        ) : (
          <ul className="mt-4 space-y-2">
            {dueToday.map((h) => (
              <TodayRow
                key={h.id}
                habit={h}
                status={todayLog.get(h.id)?.status}
                logs={liveLogs.filter((l) => l.habitId === h.id)}
                today={today}
                weekStartsOn={weekStartsOn}
                onToggleDone={() => toggleToday(h, "done")}
                onSkip={() => toggleToday(h, "skipped")}
              />
            ))}
          </ul>
        )
      ) : active.length === 0 ? (
        <EmptyState kind="none" onAdd={() => setShowNew(true)} />
      ) : (
        <div className="mt-4 space-y-2">
          {active.map((h) => (
            <AllHabitRow
              key={h.id}
              habit={h}
              logs={liveLogs.filter((l) => l.habitId === h.id)}
              today={today}
              weekStartsOn={weekStartsOn}
              expanded={expandedId === h.id}
              onExpand={() => setExpandedId(expandedId === h.id ? null : h.id)}
              onCycle={cycleDay}
              onDelete={() => removeHabit(h)}
              onArchive={() => archiveHabit(h)}
            />
          ))}
          {archived.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {t.habits.archived}
                <span className="ms-1 font-normal tabular-nums">
                  ({formatNumber(locale, archived.length)})
                </span>
              </h2>
              <ul className="mt-2 space-y-2">
                {archived.map((h) => (
                  <li key={h.id} className="panel flex items-center gap-3 p-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      {h.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => habitApi.update(h.id, { archived: false })}
                      className={OUTLINE_BTN + " px-3 py-1.5"}
                    >
                      <ArchiveRestore className="size-4" aria-hidden />
                      {t.habits.unarchive}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeHabit(h)}
                      aria-label={t.habits.delete}
                      className="hit-extend rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-destructive"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------------- skeleton / empty ---------------- */

function HabitsSkeleton() {
  return (
    <section aria-busy="true">
      <div className="mb-2 h-4 w-16 skeleton" />
      <div className="h-9 w-56 skeleton" />
      <div className="mt-6 h-10 w-44 skeleton rounded-lg" />
      <div className="mt-6 space-y-2">
        <div className="h-14 skeleton rounded-xl" />
        <div className="h-14 skeleton rounded-xl" />
        <div className="h-14 skeleton rounded-xl" />
      </div>
    </section>
  );
}

function EmptyState({ kind, onAdd }: { kind: "none" | "today"; onAdd: () => void }) {
  const { t } = usePrefs();
  const e = kind === "none" ? t.habits.empty.all : t.habits.empty.today;
  return (
    <div className="empty-card mt-4">
      <span className="grid size-12 place-items-center rounded-full bg-accent/40 text-primary">
        <Sprout className="size-6" aria-hidden />
      </span>
      <p className="font-display text-lg font-semibold">{e.title}</p>
      <p className="text-sm text-muted-foreground">{e.body}</p>
      <button type="button" onClick={onAdd} className={PRIMARY_BTN}>
        {t.habits.empty.action}
      </button>
    </div>
  );
}

/* ---------------- create / edit ---------------- */

function NewHabitForm({
  weekStartsOn,
  nameRef,
  onAdd,
  onCancel,
}: {
  weekStartsOn: number;
  nameRef: RefObject<HTMLInputElement | null>;
  onAdd: (name: string, schedule: HabitSchedule) => void;
  onCancel: () => void;
}) {
  const { t } = usePrefs();
  const [name, setName] = useState("");
  const [type, setType] = useState<HabitSchedule["type"]>("daily");
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const valid = name.trim() !== "" && (type === "daily" || days.length > 0);
  return (
    <form
      className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const schedule: HabitSchedule =
          type === "daily"
            ? { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] }
            : { type, days: [...days].sort((a, b) => a - b) };
        onAdd(name.trim(), schedule);
      }}
    >
      <input
        ref={nameRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.habits.namePlaceholder}
        aria-label={t.habits.nameLabel}
        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none"
      />
      <Segmented
        options={[
          { value: "daily", label: t.habits.scheduleType.daily },
          { value: "weekly", label: t.habits.scheduleType.weekly },
          { value: "custom", label: t.habits.scheduleType.custom },
        ]}
        value={type}
        onChange={(v) => setType(v as HabitSchedule["type"])}
        label={t.habits.schedule}
      />
      {type !== "daily" && (
        <div>
          <WeekdayGrid
            days={days}
            onChange={setDays}
            weekStartsOn={weekStartsOn}
            label={t.habits.schedule}
          />
          {days.length === 0 && (
            <p className="mt-1 text-xs text-destructive">{t.habits.daysRequired}</p>
          )}
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className={OUTLINE_BTN}>
          {t.habits.cancel}
        </button>
        <button type="submit" disabled={!valid} className={PRIMARY_BTN}>
          {t.habits.add}
        </button>
      </div>
    </form>
  );
}

function HabitEditor({ habit, weekStartsOn }: { habit: Habit; weekStartsOn: number }) {
  const { t } = usePrefs();
  const [name, setName] = useState(habit.name);
  const [type, setType] = useState<HabitSchedule["type"]>(habit.schedule.type);
  const [days, setDays] = useState<number[]>([...habit.schedule.days]);
  const dirty =
    name.trim() !== habit.name ||
    type !== habit.schedule.type ||
    (type !== "daily" && !sameDays(days, habit.schedule.days));
  const valid = name.trim() !== "" && (type === "daily" || days.length > 0);
  return (
    <div className="space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label={t.habits.nameLabel}
        className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none"
      />
      <Segmented
        options={[
          { value: "daily", label: t.habits.scheduleType.daily },
          { value: "weekly", label: t.habits.scheduleType.weekly },
          { value: "custom", label: t.habits.scheduleType.custom },
        ]}
        value={type}
        onChange={(v) => setType(v as HabitSchedule["type"])}
        label={t.habits.schedule}
      />
      {type !== "daily" && (
        <WeekdayGrid
          days={days}
          onChange={setDays}
          weekStartsOn={weekStartsOn}
          label={t.habits.schedule}
        />
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setName(habit.name);
            setType(habit.schedule.type);
            setDays([...habit.schedule.days]);
          }}
          className={OUTLINE_BTN + " px-3 py-1.5"}
        >
          {t.habits.cancel}
        </button>
        <button
          type="button"
          disabled={!valid || !dirty}
          onClick={() => {
            const schedule: HabitSchedule =
              type === "daily"
                ? { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] }
                : { type, days: [...days].sort((a, b) => a - b) };
            habitApi.update(habit.id, { name: name.trim(), schedule });
          }}
          className={PRIMARY_BTN + " px-3 py-1.5"}
        >
          {t.habits.save}
        </button>
      </div>
    </div>
  );
}

function WeekdayGrid({
  days,
  onChange,
  weekStartsOn,
  label,
}: {
  days: number[];
  onChange: (next: number[]) => void;
  weekStartsOn: number;
  label: string;
}) {
  const { locale } = usePrefs();
  const ordered = [...WEEKDAYS].sort(
    (a, b) => ((a - weekStartsOn + 7) % 7) - ((b - weekStartsOn + 7) % 7),
  );
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
      {ordered.map((d) => {
        const on = days.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? days.filter((x) => x !== d) : [...days, d])}
            className={
              "h-8 min-w-9 rounded-md border px-2 text-xs font-medium transition-colors " +
              (on
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground")
            }
          >
            {weekdayShort(locale, d)}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- rows ---------------- */

function TodayRow({
  habit,
  status,
  logs,
  today,
  weekStartsOn,
  onToggleDone,
  onSkip,
}: {
  habit: Habit;
  status: "done" | "skipped" | undefined;
  logs: HabitLog[];
  today: string;
  weekStartsOn: number;
  onToggleDone: () => void;
  onSkip: () => void;
}) {
  const { t, locale } = usePrefs();
  const done = status === "done";
  const skipped = status === "skipped";
  const streak = habitStreaks(habit, logs, today, weekStartsOn).current;
  return (
    <li className="panel flex items-center gap-3 p-3">
      <CheckButton checked={done} onToggle={onToggleDone} label={t.habits.done} />
      <span className="min-w-0 flex-1">
        <span
          className={"text-sm font-medium " + (done ? "text-muted-foreground line-through" : "")}
        >
          {habit.name}
        </span>
        {streak > 0 && (
          <span className="ms-2 inline-flex items-center gap-1 text-xs text-primary">
            <Flame className="size-3" aria-hidden />
            {plural(locale, t.daysStreak, streak)}
          </span>
        )}
        {habit.pausedUntil !== undefined && habit.pausedUntil >= today && (
          <span className="chip border-warning/50 text-warning">
            <Snowflake className="size-3" aria-hidden />
            {t.habits.frozenChip.replace(
              "{date}",
              formatDate(locale, new Date(habit.pausedUntil + "T12:00:00Z"), {
                dateStyle: "medium",
              }),
            )}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onSkip}
        aria-pressed={skipped}
        className={
          "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors " +
          (skipped
            ? "border-primary/70 bg-transparent text-primary"
            : "border-border bg-background text-muted-foreground hover:text-foreground")
        }
      >
        <SkipForward className="size-4 rtl-flip" aria-hidden />
        {t.habits.skip}
      </button>
    </li>
  );
}

function AllHabitRow({
  habit,
  logs,
  today,
  weekStartsOn,
  expanded,
  onExpand,
  onCycle,
  onDelete,
  onArchive,
}: {
  habit: Habit;
  logs: HabitLog[];
  today: string;
  weekStartsOn: number;
  expanded: boolean;
  onExpand: () => void;
  onCycle: (habitId: string, day: LocalDay) => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  const { t, locale } = usePrefs();
  const streaks = habitStreaks(habit, logs, today, weekStartsOn);
  const cons = consistency30(habit, logs, today);
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={expanded}
          className="min-w-0 flex-1 text-start"
        >
          <span className="text-sm font-medium">{habit.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{scheduleSummary(locale, habit.schedule, weekStartsOn, t.habits.everyday)}</span>
            {habit.pausedUntil !== undefined && habit.pausedUntil >= today && (
              <span className="chip border-warning/50 text-warning">
                <Snowflake className="size-3" aria-hidden />
                {t.habits.frozenChip.replace(
                  "{date}",
                  formatDate(locale, new Date(habit.pausedUntil + "T12:00:00Z"), {
                    dateStyle: "medium",
                  }),
                )}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Flame className="size-3 text-primary" aria-hidden />
              {plural(locale, t.daysStreak, streaks.current)}
            </span>
            <span className="inline-flex items-center gap-1">
              <span>{t.habits.best}</span>
              <span className="tabular-nums">{formatNumber(locale, streaks.best)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span>{t.habits.consistency}</span>
              <span className="tabular-nums">
                {cons === null ? "—" : formatNumber(locale, Math.round(cons * 100)) + "%"}
              </span>
            </span>
          </span>
        </button>
      </div>
      {expanded && (
        <div className="border-t border-border p-3">
          <HabitEditor habit={habit} weekStartsOn={weekStartsOn} />
          <FreezeControl habit={habit} today={today} />
          <div className="mt-4 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{t.habits.history}</h3>
            <ShareButton habit={habit} logs={logs} today={today} weekStartsOn={weekStartsOn} />
          </div>
          <div className="mt-2">
            <Heatmap
              habit={habit}
              logs={logs}
              today={today}
              weekStartsOn={weekStartsOn}
              onLog={onCycle}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={onArchive} className={OUTLINE_BTN + " px-3 py-1.5"}>
              <Archive className="size-4" aria-hidden />
              {t.habits.archive}
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={t.habits.delete}
              className="hit-extend rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- heatmap ---------------- */

function Heatmap({
  habit,
  logs,
  today,
  weekStartsOn,
  onLog,
}: {
  habit: Habit;
  logs: HabitLog[];
  today: LocalDay;
  weekStartsOn: number;
  onLog: (habitId: string, day: LocalDay) => void;
}) {
  const { t, locale } = usePrefs();
  const by = logsByDay(logs);
  const firstWeek = startOfWeek(addDays(today, -(HEAT_WEEKS - 1) * 7), weekStartsOn);
  const windowStart = addDays(today, -LOG_WINDOW_DAYS);
  const labelOf = (kind: DayKind): string =>
    kind === "done"
      ? t.habits.done
      : kind === "skipped"
        ? t.habits.skipped
        : kind === "missed"
          ? t.habits.missed
          : kind === "upcoming"
            ? t.habits.upcoming
            : kind === "frozen"
              ? t.habits.frozen
              : t.habits.notScheduled;

  const weeks: LocalDay[][] = [];
  for (let w = 0; w < HEAT_WEEKS; w++) {
    const col: LocalDay[] = [];
    for (let i = 0; i < 7; i++) col.push(addDays(firstWeek, w * 7 + i));
    weeks.push(col);
  }

  return (
    <div className="mt-2">
      {/* Week columns flow with inline direction: the oldest week sits at the
          start edge, so the timeline mirrors automatically in RTL. */}
      <div className="flex flex-row gap-1 overflow-x-auto">
        {weeks.map((col, wi) => (
          <div key={col[0] ?? wi} className="flex flex-col gap-1">
            {col.map((day) => {
              const kind = dayKind(habit.schedule, by, day, today, habit);
              const canLog =
                day >= windowStart && day <= today && isScheduledOn(habit.schedule, day);
              const title =
                formatDate(locale, new Date(day + "T12:00:00Z"), { dateStyle: "medium" }) +
                " — " +
                labelOf(kind);
              return canLog ? (
                <button
                  key={day}
                  type="button"
                  title={title}
                  aria-label={title}
                  onClick={() => onLog(habit.id, day)}
                  className={
                    "size-4 shrink-0 rounded-sm border transition-colors hover:ring-1 hover:ring-primary " +
                    KIND_CLS[kind]
                  }
                />
              ) : (
                <span
                  key={day}
                  title={title}
                  className={"size-4 shrink-0 rounded-sm border " + KIND_CLS[kind]}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {(KIND_LEGEND as DayKind[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={"size-3 rounded-sm border " + KIND_CLS[k]} aria-hidden />
            {labelOf(k)}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t.habits.historyHint}</p>
    </div>
  );
}

/* ---------------- shared bits ---------------- */

function CheckButton({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={
        "hit-extend grid size-5 shrink-0 place-items-center rounded-full border transition-colors " +
        (checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-transparent hover:border-primary")
      }
    >
      <Check className={checked ? "animate-check size-3" : "size-3"} aria-hidden />
    </button>
  );
}

/* ---------------- streak freeze & share card ---------------- */

function FreezeControl({ habit, today }: { habit: Habit; today: string }) {
  const { t, locale } = usePrefs();
  const [until, setUntil] = useState(addDays(today, 7));
  const frozen = habit.pausedUntil !== undefined && habit.pausedUntil >= today;
  return (
    <div className="mt-3 rounded-lg border border-border bg-background/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Snowflake className="size-4 text-warning" aria-hidden />
          {t.habits.freeze}
        </p>
        {frozen ? (
          <button
            type="button"
            onClick={() =>
              habitApi.update(habit.id, { pausedUntil: undefined, pausedFrom: undefined })
            }
            className={OUTLINE_BTN + " px-3 py-1.5"}
          >
            {t.habits.unfreeze}
          </button>
        ) : (
          <span className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground" htmlFor={"freeze-" + habit.id}>
              {t.habits.freezeUntil}
            </label>
            <input
              id={"freeze-" + habit.id}
              type="date"
              min={today}
              value={until}
              onChange={(e) => setUntil(e.target.value || addDays(today, 7))}
              className="h-8 rounded-md border border-border bg-card px-2 text-sm tabular-nums"
            />
            <button
              type="button"
              onClick={() => habitApi.update(habit.id, { pausedUntil: until, pausedFrom: today })}
              className={PRIMARY_BTN + " px-3 py-1.5"}
            >
              {t.habits.freeze}
            </button>
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{t.habits.freezeHint}</p>
      {frozen && (
        <p className="mt-1 text-xs text-warning">
          {t.habits.frozenChip.replace(
            "{date}",
            formatDate(locale, new Date(habit.pausedUntil! + "T12:00:00Z"), {
              dateStyle: "medium",
            }),
          )}
        </p>
      )}
    </div>
  );
}

function ShareButton({
  habit,
  logs,
  today,
  weekStartsOn,
}: {
  habit: Habit;
  logs: HabitLog[];
  today: string;
  weekStartsOn: number;
}) {
  const { t } = usePrefs();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={OUTLINE_BTN + " px-3 py-1.5"}>
        <Share2 className="size-4" aria-hidden />
        {t.habits.share}
      </button>
      {open && (
        <ShareModal
          habit={habit}
          logs={logs}
          today={today}
          weekStartsOn={weekStartsOn}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ShareModal({
  habit,
  logs,
  today,
  weekStartsOn,
  onClose,
}: {
  habit: Habit;
  logs: HabitLog[];
  today: string;
  weekStartsOn: number;
  onClose: () => void;
}) {
  const { t, locale } = usePrefs();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [url, setUrl] = useState("");
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const by = logsByDay(logs);
    const firstWeek = startOfWeek(addDays(today, -(HEAT_WEEKS - 1) * 7), weekStartsOn);
    const weeks: ShareCellKind[][] = [];
    for (let w = 0; w < HEAT_WEEKS; w++) {
      const col: ShareCellKind[] = [];
      for (let i = 0; i < 7; i++) {
        const day = addDays(firstWeek, w * 7 + i);
        col.push(dayKind(habit.schedule, by, day, today, habit));
      }
      weeks.push(col);
    }
    const streaks = habitStreaks(habit, logs, today, weekStartsOn);
    const cons = consistency30(habit, logs, today);
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim();
    drawShareCard(canvas, {
      title: habit.name,
      subtitle: t.habits.shareTitle,
      weeks,
      stats: [
        {
          label: t.habits.consistency,
          value: cons === null ? "—" : formatNumber(locale, Math.round(cons * 100)) + "%",
        },
        { label: t.habits.streakNow, value: formatNumber(locale, streaks.current) },
        { label: t.habits.best, value: formatNumber(locale, streaks.best) },
      ],
      colors: {
        background: token("--color-background"),
        card: token("--color-card"),
        foreground: token("--color-foreground"),
        muted: token("--color-muted-foreground"),
        primary: token("--color-primary"),
        accent: token("--color-accent"),
        border: token("--color-border"),
        warning: token("--color-warning"),
      },
      rtl: locale === "ar",
    });
    setUrl(shareCardDataUrl(canvas));
  };
  // The canvas lives inside a Radix portal and mounts a commit after this
  // component's effects — a callback ref draws the moment it exists.
  const setCanvas = (el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
    if (el) draw();
  };
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habit, logs, today, weekStartsOn, t, locale]);
  return (
    <Modal title={t.habits.share} onClose={onClose}>
      <h2 className="font-display text-lg font-semibold">{t.habits.share}</h2>
      <canvas
        ref={setCanvas}
        className="mt-3 w-full rounded-lg border border-border"
        aria-label={t.habits.shareTitle}
      />
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={onClose} className={OUTLINE_BTN}>
          {t.capture.close}
        </button>
        <a href={url} download={"tilth-" + habit.id + ".png"} className={PRIMARY_BTN}>
          {t.habits.shareDownload}
        </a>
      </div>
    </Modal>
  );
}

/* ---------------- pure helpers ---------------- */

function scheduleSummary(
  locale: Locale,
  schedule: HabitSchedule,
  weekStartsOn: number,
  everyday: string,
): string {
  if (schedule.type === "daily" || schedule.days.length >= 7) return everyday;
  const ordered = [...WEEKDAYS].sort(
    (a, b) => ((a - weekStartsOn + 7) % 7) - ((b - weekStartsOn + 7) % 7),
  );
  const names = ordered
    .filter((d) => schedule.days.includes(d))
    .map((d) => weekdayShort(locale, d));
  return names.join(locale === "ar" ? "، " : ", ");
}

function sameDays(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((x, i) => x === sb[i]);
}

function weekdayShort(locale: Locale, d: number): string {
  // 2023-01-01 was a Sunday, so the 1st + d lands on that weekday.
  const day = new Date(Date.UTC(2023, 0, 1 + d));
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(day);
}
