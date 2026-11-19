import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Coffee,
  Pause,
  Play,
  Timer,
  Volume2,
  VolumeX,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrefs } from "@/components/app/preferences";
import { Segmented } from "@/components/app/Segmented";
import { PageHeader } from "@/components/app/PageHeader";
import { Modal } from "@/components/app/Modal";
import { OUTLINE_BTN, PRIMARY_BTN, DANGER_BTN } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDate, formatNumber } from "@/lib/i18n";
import { focus as focusApi, todayLocal, useStore } from "@/lib/store";
import {
  actualMinutes,
  groupByDay,
  isActive,
  isOverdue,
  nextBreakMinutes,
  remainingMs,
  workCompletedToday,
  workMinutesToday,
} from "@/lib/focusTime";
import { distractionsByDay } from "@/lib/distractionReview";
import type { FocusSession, Task } from "@/lib/types";
import { startAmbience, stopAmbience, type AmbienceKind } from "@/lib/ambience";

export const Route = createFileRoute("/focus")({
  head: () => ({
    meta: [
      { title: "Focus — Tilth" },
      {
        name: "description",
        content: "Deep focus sessions with a timer that survives reloads and background tabs.",
      },
      { property: "og:title", content: "Focus — Tilth" },
      {
        property: "og:description",
        content: "Deep focus sessions with a timer that survives reloads and background tabs.",
      },
    ],
  }),
  component: FocusPage,
});

const PRIORITY_RANK: Record<Task["priority"], number> = { high: 0, medium: 1, low: 2 };

function FocusPage() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const allSessions = useStore((s) => s.focusSessions);
  const allTasks = useStore((s) => s.tasks);
  const target = useStore((s) => s.settings.dailyFocusTargetMinutes);
  const active = useStore((s) => s.focusSessions.find((x) => isActive(x)));
  const [mode, setMode] = useState<"pomodoro" | "custom">("pomodoro");
  const [customWork, setCustomWork] = useState(25);
  const [customBreak, setCustomBreak] = useState(5);
  const [linkedTaskId, setLinkedTaskId] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [ambience, setAmbience] = useState<AmbienceKind>("off");
  const [breakReady, setBreakReady] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [tick, setTick] = useState(0);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  // localStorage is a tiny UI pref (see AGENTS.md); read after mount to avoid hydration drift.
  useEffect(() => {
    try {
      if (window.localStorage.getItem("tilth.focus-sound") === "0") setSoundOn(false);
      const a = window.localStorage.getItem("tilth.focus-ambience");
      if (a === "rain" || a === "brown" || a === "white") setAmbience(a);
    } catch {
      /* ignore */
    }
  }, []);

  // Ambience lives only while a session runs and sound is on; every node is
  // released on stop so repeated sessions never leak audio resources.
  useEffect(() => {
    if (active && soundOn && ambience !== "off") startAmbience(ambience);
    else stopAmbience();
  }, [active, soundOn, ambience]);
  useEffect(() => () => stopAmbience(), []);

  const pickAmbience = (k: AmbienceKind) => {
    setAmbience(k);
    try {
      window.localStorage.setItem("tilth.focus-ambience", k);
    } catch {
      /* ignore */
    }
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    try {
      window.localStorage.setItem("tilth.focus-sound", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  // The interval only triggers re-render; time is always computed from timestamps.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [active]);

  // Re-check on tab focus/visibility so a session that ended while away completes instantly.
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    document.addEventListener("visibilitychange", bump);
    window.addEventListener("focus", bump);
    return () => {
      document.removeEventListener("visibilitychange", bump);
      window.removeEventListener("focus", bump);
    };
  }, []);

  const showToast = (msg: string) => toast(msg);

  const startWork = useCallback(() => {
    const minutes = mode === "pomodoro" ? 25 : customWork;
    focusApi.start(mode, minutes, linkedTaskId === "" ? undefined : linkedTaskId);
    setBreakReady(null);
  }, [mode, customWork, linkedTaskId]);

  const startBreakSession = () => {
    const short = mode === "pomodoro" ? 5 : customBreak;
    const minutes =
      breakReady ??
      nextBreakMinutes(
        workCompletedToday(useStore.getState().focusSessions, todayLocal()),
        short,
        15,
      );
    focusApi.start("break", minutes);
    setBreakReady(null);
  };

  const togglePause = useCallback(() => {
    if (!active) return;
    if (active.pausedAt) focusApi.resume(active.id);
    else focusApi.pause(active.id);
  }, [active]);

  const distraction = () => {
    if (active) focusApi.distraction(active.id);
  };

  const confirmCancel = () => {
    if (active) focusApi.end(active.id, false);
    setConfirming(false);
  };

  // Completed only when the session RAN to endsAt (overdue check on every tick).
  useEffect(() => {
    if (!active || active.pausedAt !== undefined || !isOverdue(active, Date.now())) return;
    const s = active;
    focusApi.end(s.id, true);
    if (soundRef.current) chime();
    if (s.mode !== "break") {
      const short = s.mode === "pomodoro" ? 5 : customBreak;
      const done = workCompletedToday(useStore.getState().focusSessions, todayLocal());
      setBreakReady(nextBreakMinutes(done, short, 15));
    }
    showToast(t.focus.toasts.completed);
  }, [active, tick, customBreak, t]);

  // Space = start/pause, Esc = cancel (with confirm). Never while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirming) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT"))
        return;
      // TIL-F18: Space is a global shortcut only when focus is NOT on an
      // interactive control — otherwise it hijacks buttons and radios.
      // Escape must ALWAYS cancel: after a mouse click on Pause/Resume the
      // focused button must not swallow the documented cancel shortcut.
      if (e.code === "Space") {
        if (
          el?.closest?.(
            "button, a[href], [role='button'], [role='radio'], [role='checkbox'], [role='switch'], [role='tab'], [contenteditable]",
          )
        )
          return;
        e.preventDefault();
        if (active) togglePause();
        else if (ready) startWork();
      }
      if (e.key === "Escape" && active) setConfirming(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, confirming, ready, startWork, togglePause]);

  // Memoized: the 500 ms timer tick re-renders this page, and none of these
  // depend on the tick — they must not recompute on every tick. Hooks stay
  // above the !ready early return.
  const today = todayLocal();
  const liveSessions = useMemo(() => allSessions.filter((s) => !s.deletedAt), [allSessions]);
  const doneMinutes = useMemo(() => workMinutesToday(liveSessions, today), [liveSessions, today]);
  const openTasks = useMemo(
    () => allTasks.filter((x) => !x.deletedAt && x.status !== "done"),
    [allTasks],
  );
  const taskTitles = useMemo(
    () => new Map(allTasks.filter((x) => !x.deletedAt).map((x) => [x.id, x.title])),
    [allTasks],
  );

  // Suggest the top-priority open task as the session’s link — a draft the
  // user accepts by tapping; nothing is linked automatically.
  const suggestedTask = useMemo(() => {
    if (openTasks.length === 0) return undefined;
    return [...openTasks].sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        (a.dueDate ?? "").localeCompare(b.dueDate ?? ""),
    )[0];
  }, [openTasks]);

  const distractionByDay = useMemo(
    () => distractionsByDay(liveSessions, today),
    [liveSessions, today],
  );

  if (!ready) return <FocusSkeleton />;

  const pct = target <= 0 ? 0 : Math.min(100, Math.round((doneMinutes / target) * 100));

  return (
    <section>
      <PageHeader
        title={t.pages.focus.title}
        lede={liveSessions.length === 0 ? t.pages.focus.body : undefined}
      />

      <div className="mt-6">
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{t.focus.todaysFocus}</span>
          <span className="tabular-nums">
            {formatNumber(locale, doneMinutes) +
              " / " +
              formatNumber(locale, target) +
              " " +
              t.focus.minutes}
          </span>
        </div>
        <div className="meter">
          <div className="meter-fill" style={{ width: pct + "%" }} />
        </div>
      </div>

      {active ? (
        <ActivePanel
          active={active}
          taskTitle={taskTitles.get(active.linkedTaskId ?? "")}
          soundOn={soundOn}
          onToggleSound={toggleSound}
          ambience={ambience}
          onAmbience={pickAmbience}
          onTogglePause={togglePause}
          onDistraction={distraction}
          onCancelRequest={() => setConfirming(true)}
        />
      ) : (
        <div className="panel mt-6 space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              options={[
                { value: "pomodoro", label: t.focus.mode.pomodoro },
                { value: "custom", label: t.focus.mode.custom },
              ]}
              value={mode}
              onChange={(v) => setMode(v === "custom" ? "custom" : "pomodoro")}
              label={t.nav.focus}
            />
            <span className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <AmbienceSelect value={ambience} onChange={pickAmbience} />
              <button
                type="button"
                onClick={toggleSound}
                aria-pressed={soundOn}
                className={OUTLINE_BTN + " w-full min-w-0 max-w-full px-3 py-1.5 sm:w-auto"}
              >
                {soundOn ? (
                  <Volume2 className="size-4 shrink-0" aria-hidden />
                ) : (
                  <VolumeX className="size-4 shrink-0" aria-hidden />
                )}
                <span className="min-w-0 truncate">{t.focus.sound}</span>
              </button>
            </span>
          </div>
          {mode === "pomodoro" ? (
            <p className="text-sm text-muted-foreground">{t.focus.pomodoroHint}</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">
                  {t.focus.workMinutes}
                </span>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={customWork}
                  onChange={(e) => setCustomWork(clampNum(e.target.value, 1, 180))}
                  className="h-9 w-24 rounded-md border border-border bg-background px-3 text-sm tabular-nums outline-none"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">
                  {t.focus.breakMinutes}
                </span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={customBreak}
                  onChange={(e) => setCustomBreak(clampNum(e.target.value, 1, 60))}
                  className="h-9 w-24 rounded-md border border-border bg-background px-3 text-sm tabular-nums outline-none"
                />
              </label>
            </div>
          )}
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">{t.focus.linkedTask}</span>
            <select
              value={linkedTaskId}
              onChange={(e) => setLinkedTaskId(e.target.value)}
              className="h-9 w-full max-w-sm rounded-md border border-border bg-card px-2 text-sm text-foreground"
            >
              <option value="">{t.focus.none}</option>
              {openTasks.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </select>
          </label>
          {suggestedTask && linkedTaskId === "" && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t.focus.linkSuggest}</span>
              <button
                type="button"
                onClick={() => setLinkedTaskId(suggestedTask.id)}
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                {suggestedTask.title}
              </button>
            </div>
          )}
          {breakReady !== null ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={startBreakSession} className={PRIMARY_BTN}>
                <Coffee className="size-4" aria-hidden />
                {t.focus.startBreak}
                <span className="tabular-nums">
                  {"(" + formatNumber(locale, breakReady) + " " + t.focus.minutes + ")"}
                </span>
              </button>
              <span className="text-xs text-muted-foreground">{t.focus.toasts.breakReady}</span>
            </div>
          ) : (
            <button type="button" onClick={startWork} className={PRIMARY_BTN}>
              <Play className="size-4" aria-hidden />
              {t.focus.start}
            </button>
          )}
          <p className="text-xs text-muted-foreground">{t.focus.notifications}</p>
        </div>
      )}

      {distractionByDay.some((d) => d.count > 0) && (
        <div className="mt-6 panel p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t.distraction.title}
          </h3>
          <div className="mt-2 flex flex-wrap gap-1">
            {distractionByDay.map((d) => {
              const cls =
                d.count === 0
                  ? "border-border/40 bg-transparent"
                  : d.count <= 2
                    ? "border-warning/40 bg-warning/30"
                    : "border-destructive/40 bg-destructive/30";
              return (
                <span
                  key={d.day}
                  title={
                    formatDate(locale, new Date(d.day + "T12:00:00Z"), { dateStyle: "medium" }) +
                    ": " +
                    d.count +
                    " " +
                    t.distraction.label
                  }
                  className={
                    "size-6 shrink-0 rounded border flex items-center justify-center text-[10px] tabular-nums text-muted-foreground " +
                    cls
                  }
                >
                  {d.count}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <HistorySection sessions={liveSessions} taskTitles={taskTitles} />

      {confirming && active && (
        <Modal title={t.focus.cancelTitle} onClose={() => setConfirming(false)}>
          <h2 className="font-display text-lg font-semibold">{t.focus.cancelTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.focus.cancelBody}</p>
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={() => setConfirming(false)} className={OUTLINE_BTN}>
              {t.focus.keep}
            </button>
            <button type="button" onClick={confirmCancel} className={DANGER_BTN}>
              {t.focus.cancel}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

/* ---------------- active session ---------------- */

const FOCUS_R = 45; // pure geometry, workerd-safe at module level
const FOCUS_C = 2 * Math.PI * FOCUS_R;

function ActivePanel({
  active,
  taskTitle,
  soundOn,
  onToggleSound,
  ambience,
  onAmbience,
  onTogglePause,
  onDistraction,
  onCancelRequest,
}: {
  active: FocusSession;
  taskTitle: string | undefined;
  soundOn: boolean;
  onToggleSound: () => void;
  ambience: AmbienceKind;
  onAmbience: (k: AmbienceKind) => void;
  onTogglePause: () => void;
  onDistraction: () => void;
  onCancelRequest: () => void;
}) {
  const { t, locale } = usePrefs();
  // Wall-clock math on every render — never interval counting.
  const remaining = remainingMs(active, Date.now());
  const total = active.plannedMinutes * 60_000;
  const remainingRatio = Math.max(0, Math.min(1, remaining / total));
  const paused = active.pausedAt !== undefined;
  const isBreak = active.mode === "break";
  return (
    <div className="panel mt-6 p-6 text-center">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-primary">
          {active.mode === "break" ? t.focus.break : t.focus.mode[active.mode]}
          {taskTitle !== undefined && (
            <span className="text-muted-foreground">{" — " + taskTitle}</span>
          )}
        </p>
        <AmbienceSelect value={ambience} onChange={onAmbience} compact />
        {/* Mute stays reachable mid-session — a running chime can always be silenced. */}
        <button
          type="button"
          onClick={onToggleSound}
          aria-pressed={soundOn}
          aria-label={t.focus.sound}
          title={t.focus.sound}
          className={
            "hit-extend shrink-0 rounded-full p-2 transition-colors " +
            (soundOn
              ? "text-primary hover:bg-accent/40"
              : "text-muted-foreground hover:bg-accent/40")
          }
        >
          {soundOn ? (
            <Volume2 className="size-5" aria-hidden />
          ) : (
            <VolumeX className="size-5" aria-hidden />
          )}
        </button>
      </div>

      <div className="relative mx-auto mt-5 w-fit">
        <svg
          viewBox="0 0 100 100"
          className={
            "size-56 md:size-64 " +
            (isBreak ? "text-info" : "text-primary") +
            (paused ? " opacity-60" : " timer-glow animate-breathe")
          }
          aria-hidden
        >
          <circle
            cx="50"
            cy="50"
            r={FOCUS_R}
            fill="none"
            strokeWidth="5"
            className="stroke-accent/40"
          />
          <circle
            cx="50"
            cy="50"
            r={FOCUS_R}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={FOCUS_C}
            strokeDashoffset={FOCUS_C * (1 - remainingRatio)}
            transform="rotate(-90 50 50)"
            style={{ transition: "stroke-dashoffset 500ms linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p
            role="timer"
            aria-live="off"
            className="font-display text-5xl font-semibold tabular-nums md:text-6xl"
          >
            {clock(remaining)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {formatNumber(locale, active.plannedMinutes) + " " + t.focus.minutes}
          </p>
          {paused && <p className="mt-2 text-sm text-muted-foreground">{t.focus.pause}</p>}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={onTogglePause} className={PRIMARY_BTN}>
          {paused ? (
            <Play className="size-4" aria-hidden />
          ) : (
            <Pause className="size-4" aria-hidden />
          )}
          {paused ? t.focus.resume : t.focus.pause}
        </button>
        <button type="button" onClick={onDistraction} className={OUTLINE_BTN}>
          <Zap className="size-4" aria-hidden />
          {t.focus.distract}
          {active.distractions.length > 0 && (
            <span className="tabular-nums">
              {"(" + formatNumber(locale, active.distractions.length) + ")"}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onCancelRequest}
          className={OUTLINE_BTN + " text-destructive"}
        >
          {t.focus.cancel}
        </button>
      </div>
      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <kbd className="rounded border border-border bg-accent/40 px-1.5 py-0.5 font-sans text-[10px]">
          Space
        </kbd>
        <kbd className="rounded border border-border bg-accent/40 px-1.5 py-0.5 font-sans text-[10px]">
          Esc
        </kbd>
      </p>
    </div>
  );
}

/* ---------------- history ---------------- */

function HistorySection({
  sessions,
  taskTitles,
}: {
  sessions: FocusSession[];
  taskTitles: Map<string, string>;
}) {
  const { t, locale } = usePrefs();
  const groups = useMemo(() => groupByDay(sessions), [sessions]);
  const days = useMemo(() => [...groups.keys()].sort((a, b) => b.localeCompare(a)), [groups]);
  if (days.length === 0) return <FocusEmpty />;
  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-muted-foreground">{t.focus.history}</h2>
      {days.map((day) => (
        <div key={day} className="mt-3">
          <p className="text-xs font-medium text-muted-foreground">
            {formatDate(locale, new Date(day + "T12:00:00Z"), { dateStyle: "full" })}
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {[...(groups.get(day) ?? [])]
              .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
              .map((s) => {
                const actual = actualMinutes(s);
                const linked = taskTitles.get(s.linkedTaskId ?? "");
                return (
                  <li
                    key={s.id}
                    className="panel flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
                  >
                    {s.completed ? (
                      <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />
                    ) : (
                      <XCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <span className="font-medium">
                      {s.mode === "break" ? t.focus.break : t.focus.mode[s.mode]}
                    </span>
                    {linked !== undefined && (
                      <span className="truncate text-xs text-muted-foreground">{linked}</span>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDate(locale, new Date(s.startedAt), { timeStyle: "short" })}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatNumber(locale, s.plannedMinutes) +
                        " " +
                        t.focus.planned +
                        " / " +
                        (actual === null ? "—" : formatNumber(locale, actual)) +
                        " " +
                        t.focus.actual}
                    </span>
                    {s.distractions.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Zap className="size-3" aria-hidden />
                        {formatNumber(locale, s.distractions.length)}
                      </span>
                    )}
                    {!s.completed && (
                      <span className="text-xs text-destructive">{t.focus.incomplete}</span>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ---------------- skeleton / empty / shared ---------------- */

function FocusSkeleton() {
  return (
    <section aria-busy="true">
      <div className="skeleton mb-2 h-4 w-16" />
      <div className="skeleton h-9 w-56" />
      <div className="skeleton mt-6 h-2 w-full rounded-full" />
      <div className="skeleton mt-4 h-56 rounded-xl" />
      <div className="mt-6 space-y-2">
        <div className="skeleton h-10 rounded-lg" />
        <div className="skeleton h-10 rounded-lg" />
      </div>
    </section>
  );
}

function FocusEmpty() {
  const { t } = usePrefs();
  return (
    <div className="empty-card mt-4">
      <span className="grid size-12 place-items-center rounded-full bg-accent/40 text-primary">
        <Timer className="size-6" aria-hidden />
      </span>
      <p className="font-display text-lg font-semibold">{t.focus.empty.title}</p>
      <p className="text-sm text-muted-foreground">{t.focus.empty.body}</p>
    </div>
  );
}

function AmbienceSelect({
  value,
  onChange,
  compact,
}: {
  value: AmbienceKind;
  onChange: (k: AmbienceKind) => void;
  compact?: boolean;
}) {
  const { t } = usePrefs();
  const label = (k: AmbienceKind) =>
    k === "off"
      ? t.focus.ambienceOff
      : k === "rain"
        ? t.focus.ambienceRain
        : k === "brown"
          ? t.focus.ambienceBrown
          : t.focus.ambienceWhite;
  return (
    <label
      className={
        (compact ? "flex shrink-0" : "flex w-full min-w-0") +
        " items-center gap-1.5 text-xs text-muted-foreground"
      }
    >
      <span className={compact ? "sr-only" : "shrink-0"}>{t.focus.ambience}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AmbienceKind)}
        aria-label={t.focus.ambience}
        className={
          (compact ? "w-28" : "w-full") +
          " h-8 min-w-0 max-w-full truncate rounded-md border border-border bg-card px-2 text-xs text-foreground"
        }
      >
        {(["off", "rain", "brown", "white"] as AmbienceKind[]).map((k) => (
          <option key={k} value={k}>
            {t.focus.ambience + ": " + label(k)}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ---------------- pure helpers ---------------- */

function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ":" + (s < 10 ? "0" + s : s);
}

function clampNum(v: string, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Best-effort WebAudio chime + vibration; never throws. */
function chime() {
  try {
    const ctx = new AudioContext();
    void ctx.resume();
    const ding = (freq: number, at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.25, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.65);
      osc.start(at);
      osc.stop(at + 0.7);
    };
    const t0 = ctx.currentTime + 0.05;
    ding(784, t0);
    ding(988, t0 + 0.35);
  } catch {
    /* audio is best-effort */
  }
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([160, 90, 160]);
  } catch {
    /* ignore */
  }
}
