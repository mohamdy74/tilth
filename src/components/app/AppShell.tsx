import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronRight,
  Ellipsis,
  Languages,
  ListTodo,
  Plus,
  Repeat,
  Search,
  StickyNote,
  SunMoon,
  Target,
  Timer,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NAV, type NavKey, MOBILE_PRIMARY, MOBILE_MORE } from "./nav";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePrefs } from "./preferences";
import {
  useStore,
  tasks as tasksApi,
  notes as notesApi,
  habits as habitsApi,
  focus as focusApi,
  todayLocal,
} from "@/lib/store";
import { totalsFromLedger } from "@/lib/rewards";
import { resolveAccent } from "@/lib/themes";
import { isActive } from "@/lib/focusTime";
import { applyUpdate, registerPwa } from "@/lib/pwa";
import { toLocalDay } from "@/lib/dates";
import { searchAll } from "@/lib/search";
import { formatNumber } from "@/lib/i18n";
import { captureFromText } from "@/lib/capture";
import { composeDigest } from "@/lib/digestNotify";
import { QuickCapture } from "./QuickCapture";

type Cmd = {
  key: string;
  label: string;
  icon: LucideIcon;
  run: () => void;
  /** Small type chip shown on content-search results (TIL-F07). */
  detail?: string;
};

// TIL-F06: the desktop sidebar groups nine peer destinations into four labeled
// sections; Settings is pinned at the bottom. TIL-F01: the mobile bar shows the
// four daily-action surfaces plus a "More" sheet holding the rest — so Rewards
// and every other route stays reachable on phones.
const NAV_GROUPS: { label: "plan" | "do" | "keep" | "grow"; keys: NavKey[] }[] = [
  { label: "plan", keys: ["dashboard", "plan", "calendar"] },
  { label: "do", keys: ["tasks", "habits", "focus"] },
  { label: "keep", keys: ["notes"] },
  { label: "grow", keys: ["rewards", "insights"] },
];
const navOf = (key: NavKey) => NAV.find((n) => n.key === key)!;

export function AppShell({ children }: { children: ReactNode }) {
  const { t, setAccent } = usePrefs();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const activeSession = useStore((s) => s.focusSessions.find((x) => isActive(x)));
  const unlocks = useStore((s) => s.achievements);
  const ready = useStore((s) => s.ready);
  const settings = useStore((s) => s.settings);
  const settingsAccent = useStore((s) => s.settings.accent);
  const xpLedger = useStore((s) => s.xpLedger);
  const reducedMotion = useStore((s) => s.settings.reducedMotion ?? false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navVisibility = settings.navVisibility ?? {};
  const defaultRoute = settings.defaultRoute ?? "/";
  /** Ensures the one-time boot redirect to the default landing page runs once. */
  const redirected = useRef(false);
  const visiblePrimary = MOBILE_PRIMARY.filter((key) => navVisibility[key] !== false);
  const hiddenPrimary = MOBILE_PRIMARY.filter((key) => navVisibility[key] === false);
  const showMore = hiddenPrimary.length > 0;
  const moreSheetItems = [...hiddenPrimary, ...MOBILE_MORE];
  const moreActive = moreSheetItems.some((k) => pathname === navOf(k).to);
  const settingsItem = navOf("settings");
  const seenUnlocks = useRef<Set<string> | null>(null);

  // Sync the persisted accent (app data) into the live UI accent, resolving
  // unlock rules — also repairs legacy or re-locked values. Color-only, so
  // there is no layout shift on load or on change.
  useEffect(() => {
    if (!ready) return;
    setAccent(
      resolveAccent(settingsAccent, {
        level: totalsFromLedger(xpLedger).level,
        unlockedAchievements: unlocks.filter((u) => !u.deletedAt).map((u) => u.achievementId),
      }),
    );
  }, [ready, settingsAccent, xpLedger, unlocks, setAccent]);

  // Reduced motion: expose the preference on <html> so components (e.g. the
  // dashboard progress ring) can skip animations.
  useEffect(() => {
    document.documentElement.dataset["reducedMotion"] = String(reducedMotion);
  }, [reducedMotion]);

  // Default landing page: once the store has booted, a fresh visit to the
  // dashboard redirects to the user's preferred route (one time only).
  useEffect(() => {
    if (!ready || redirected.current) return;
    if (pathname === "/" && defaultRoute !== "/") {
      redirected.current = true;
      void navigate({ to: defaultRoute });
    }
  }, [ready, pathname, defaultRoute, navigate]);

  // Achievement unlock toast: the first run records existing unlocks
  // silently; only fresh unlocks afterwards toast, one at a time.
  useEffect(() => {
    const current = unlocks.filter((u) => !u.deletedAt);
    if (seenUnlocks.current === null) {
      seenUnlocks.current = new Set(current.map((u) => u.id));
      return;
    }
    const fresh = current.filter((u) => !seenUnlocks.current!.has(u.id));
    for (const u of fresh) seenUnlocks.current.add(u.id);
    const newest = fresh[fresh.length - 1];
    if (newest) {
      const name =
        (t.ach as Record<string, { name: string }>)[newest.achievementId]?.name ??
        newest.achievementId;
      toast(t.achUnlocked.replace("{name}", name), {
        icon: <Trophy className="size-4 text-primary" aria-hidden />,
      });
    }
  }, [unlocks, t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      // "?" toggles the palette — the discoverable cheatsheet (TIL-F12).
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = e.target as HTMLElement | null;
        if (el?.closest?.("input, textarea, select, [contenteditable]")) return;
        setOpen((o) => !o);
      }
      // "n" opens global quick capture from anywhere outside a field/dialog.
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const el = e.target as HTMLElement | null;
        if (el?.closest?.("input, textarea, select, [contenteditable]")) return;
        if (document.querySelector("[role='dialog']")) return;
        e.preventDefault();
        setCaptureOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // PWA: register the service worker (published app only) and surface waiting updates.
  useEffect(() => {
    return registerPwa(() => setNeedRefresh(true));
  }, []);

  // Quiet daily digest: at most one morning and one evening summary per day,
  // only if enabled and only while the app is open — there is no push server.
  // The shell deliberately does NOT subscribe to the collections: state is
  // read at fire time (getState), so a task edit never re-renders the shell
  // and never tears down/restarts this interval.
  const digestPrefs = settings.digest;
  const dayStartHour = settings.dayStartHour;
  useEffect(() => {
    if (!ready || !digestPrefs?.enabled) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const fire = async () => {
      const now = new Date();
      const s = useStore.getState();
      const note = composeDigest(
        s.settings.digest,
        {
          tasks: s.tasks,
          habits: s.habits,
          logs: s.habitLogs,
          sessions: s.focusSessions,
          today: toLocalDay(now, s.settings.dayStartHour, tz),
          hour: now.getHours(),
          dayStartHour: s.settings.dayStartHour,
          timeZone: tz,
        },
        t,
      );
      if (!note) return;
      try {
        const seen: Record<string, string> = JSON.parse(
          window.localStorage.getItem("tilth.digest") || "{}",
        );
        const today = toLocalDay(now, s.settings.dayStartHour, tz);
        if (seen[note.slot] === today) return;
        const snoozeUntil = Number(window.localStorage.getItem("tilth.digest-snooze") || 0);
        if (now.getTime() < snoozeUntil) return;
        const options: NotificationOptions = {
          body: note.body,
          tag: "tilth-digest-" + note.slot,
          icon: "/icons/icon-192.png",
        };
        // Published app: the service worker adds done/snooze actions. Dev and
        // preview have no worker, so the plain notification degrades gracefully.
        const reg = await navigator.serviceWorker?.getRegistration?.();
        if (reg?.active) {
          await reg.showNotification(note.title, {
            ...options,
            actions: [
              { action: "done", title: t.notifActions.done },
              { action: "snooze", title: t.notifActions.snooze },
            ],
          } as NotificationOptions);
        } else {
          new Notification(note.title, options);
        }
        seen[note.slot] = today;
        window.localStorage.setItem("tilth.digest", JSON.stringify(seen));
      } catch {
        /* ignore */
      }
    };
    void fire();
    const id = window.setInterval(() => void fire(), 60_000);
    return () => window.clearInterval(id);
  }, [ready, digestPrefs, dayStartHour, t]);

  // Digest notification actions arrive from the service worker (published app).
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; action?: string } | null;
      if (!data || data.type !== "tilth-notif") return;
      if (data.action === "snooze") {
        try {
          window.localStorage.setItem("tilth.digest-snooze", String(Date.now() + 3_600_000));
        } catch {
          /* ignore */
        }
        return;
      }
      if (data.action === "done") {
        const s = useStore.getState();
        const today = todayLocal();
        const next = s.tasks
          .filter(
            (x) =>
              !x.deletedAt && x.status !== "done" && x.dueDate !== undefined && x.dueDate <= today,
          )
          .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))[0];
        if (next) {
          tasksApi.complete(next.id);
          toast(t.tasks.toasts.completed);
        }
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [t]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#main" className="skip-link">
        {t.skip}
      </a>
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col border-e border-border bg-sidebar px-3 py-5 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-info text-primary-foreground shadow-soft">
            <Target className="size-4" aria-hidden />
          </span>
          <span className="font-display text-lg font-semibold">{t.appName}</span>
        </div>
        <button
          type="button"
          onClick={() => setCaptureOpen(true)}
          className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" aria-hidden />
          {t.capture.title}
          <kbd className="ms-auto rounded border border-primary-foreground/30 px-1.5 text-[10px] font-normal">
            N
          </kbd>
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-start text-sm text-muted-foreground transition-colors hover:bg-accent/40"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 truncate">{t.command.open}</span>
          <kbd className="rounded border border-border px-1.5 text-[10px]">⌘K</kbd>
        </button>
        <nav aria-label={t.nav.mainNav} className="flex flex-col gap-5">
          {NAV_GROUPS.map((group) => {
            const visibleKeys = group.keys.filter((key) => navVisibility[key] !== false);
            if (visibleKeys.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {t.navGroups[group.label]}
                </p>
                <div className="flex flex-col gap-0.5">
                  {visibleKeys.map((key) => {
                    const { to, icon: Icon } = navOf(key);
                    return (
                      <Link
                        key={key}
                        to={to}
                        activeOptions={{ exact: to === "/" }}
                        className="nav-link"
                        activeProps={{ "aria-current": "page", className: "nav-link-active" }}
                      >
                        <Icon className="size-4" aria-hidden />
                        {t.nav[key]}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="mt-auto pt-5">
          <Link
            to={settingsItem.to}
            className="nav-link"
            activeProps={{ "aria-current": "page", className: "nav-link-active" }}
          >
            <settingsItem.icon className="size-4" aria-hidden />
            {t.nav.settings}
          </Link>
          <p className="mt-3 border-t border-border/60 px-2 pt-3 text-xs text-muted-foreground">
            {t.tagline}
          </p>
        </div>
      </aside>

      <main id="main" className="pb-[calc(9rem+env(safe-area-inset-bottom))] md:ps-60 md:pb-0">
        <div className="mx-auto max-w-5xl px-5 py-8 md:px-10 md:py-12 animate-rise">{children}</div>
      </main>

      <nav
        aria-label={t.nav.mobileNav}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="flex w-full items-center justify-center gap-1 px-2">
          {visiblePrimary.map((key) => {
            const { to, icon: Icon } = navOf(key);
            return (
              <Link
                key={key}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="tab-link"
                activeProps={{ "aria-current": "page", className: "tab-link-active" }}
              >
                <Icon className="size-5" aria-hidden />
                <span className="w-full truncate text-center">{t.nav[key]}</span>
              </Link>
            );
          })}
          {showMore && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn("tab-link", (moreOpen || moreActive) && "tab-link-active")}
            >
              <Ellipsis className="size-5" aria-hidden />
              <span className="w-full truncate text-center">{t.nav.more}</span>
            </button>
          )}
        </div>
      </nav>

      {/* Mobile capture FAB — quick capture was desktop/keyboard-only before. */}
      <button
        type="button"
        onClick={() => setCaptureOpen(true)}
        aria-label={t.capture.title}
        className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] end-4 z-30 grid size-13 place-items-center rounded-full bg-primary text-primary-foreground shadow-elevated transition-transform active:scale-95 md:hidden"
      >
        <Plus className="size-6" aria-hidden />
      </button>

      {needRefresh && (
        <div
          className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-6"
          role="status"
        >
          <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-elevated">
            <span className="text-sm">{t.pwa.updateAvailable}</span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                disabled={!!activeSession}
                onClick={() => {
                  void applyUpdate();
                  setNeedRefresh(false);
                }}
                className="rounded-md bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              >
                {t.pwa.reload}
              </button>
              <button
                type="button"
                onClick={() => setNeedRefresh(false)}
                className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent/40"
              >
                {t.pwa.dismiss}
              </button>
            </span>
          </div>
        </div>
      )}

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-border bg-sidebar pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:hidden"
        >
          <SheetHeader className="px-2 pb-3 text-start">
            <SheetTitle className="text-sm font-semibold text-muted-foreground">
              {t.nav.more}
            </SheetTitle>
          </SheetHeader>
          <nav aria-label={t.nav.more} className="flex flex-col gap-0.5">
            {moreSheetItems.map((key) => {
              const { to, icon: Icon } = navOf(key);
              return (
                <Link
                  key={key}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  activeOptions={{ exact: to === "/" }}
                  className="nav-link py-3"
                  activeProps={{ "aria-current": "page", className: "nav-link-active" }}
                >
                  <Icon className="size-4" aria-hidden />
                  {t.nav[key]}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      {/* One toast host — identical pill and 5s lifetime from every route (TIL-F04). */}
      <Toaster
        position="bottom-center"
        duration={5000}
        mobileOffset={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }}
        offset={{ bottom: 24 }}
      />

      {captureOpen && <QuickCapture onClose={() => setCaptureOpen(false)} />}

      {open && <CommandPalette onClose={() => setOpen(false)} />}
    </div>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const { t, locale, setLocale, theme, setTheme } = usePrefs();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevFocus = useRef<Element | null>(null);

  const items = useMemo<Cmd[]>(() => {
    const nq = q.trim().toLowerCase();
    const cmds: Cmd[] = [
      {
        key: "newTask",
        label: t.command.newTask,
        icon: Plus,
        run: () => {
          try {
            window.sessionStorage.setItem("tilth.new-task", "1");
          } catch {
            /* continue to the task list if session storage is unavailable */
          }
          onClose();
          navigate({ to: "/tasks" });
        },
      },
      {
        key: "newNote",
        label: t.command.newNote,
        icon: StickyNote,
        run: () => {
          try {
            window.sessionStorage.setItem("tilth.new-note", "1");
          } catch {
            /* ignore */
          }
          onClose();
          navigate({ to: "/notes" });
        },
      },
      {
        key: "newHabit",
        label: t.command.newHabit,
        icon: Repeat,
        run: () => {
          try {
            window.sessionStorage.setItem("tilth.new-habit", "1");
          } catch {
            /* ignore */
          }
          onClose();
          navigate({ to: "/habits" });
        },
      },
      {
        key: "toggleLanguage",
        label: t.command.toggleLanguage,
        icon: Languages,
        run: () => {
          setLocale(locale === "ar" ? "en" : "ar");
          onClose();
        },
      },
      {
        key: "toggleTheme",
        label: t.command.toggleTheme,
        icon: SunMoon,
        run: () => {
          setTheme(theme === "dark" ? "light" : "dark");
          onClose();
        },
      },
      ...NAV.map((n): Cmd => ({
        key: n.key,
        label: t.nav[n.key],
        icon: n.icon,
        run: () => {
          onClose();
          navigate({ to: n.to });
        },
      })),
    ];
    return cmds.filter((c) => c.label.toLowerCase().includes(nq));
  }, [q, t, onClose, navigate, locale, setLocale, theme, setTheme]);

  // TIL-F07: the palette searches live content (ranked, Arabic-aware, across
  // tasks, notes and habits) and offers smart capture of free text.
  const content = useMemo<Cmd[]>(() => {
    const nq = q.trim();
    if (nq.length < 2) return [];
    const store = useStore.getState();
    const hits = searchAll({ tasks: store.tasks, notes: store.notes, habits: store.habits }, nq, {
      perKind: 6,
      limit: 14,
    });
    return hits.map((hit) => ({
      key: `${hit.kind}:${hit.id}`,
      label: hit.title,
      detail: hit.snippet || t.nav[hit.kind as keyof typeof t.nav],
      icon: hit.kind === "task" ? ListTodo : hit.kind === "note" ? StickyNote : Repeat,
      run: () => {
        try {
          window.sessionStorage.setItem("tilth.open-" + hit.kind, hit.id);
        } catch {
          /* ignore */
        }
        onClose();
        navigate({
          to: hit.kind === "task" ? "/tasks" : hit.kind === "note" ? "/notes" : "/habits",
        });
      },
    }));
  }, [q, t, onClose, navigate]);

  const capture = useMemo<Cmd[]>(() => {
    const nq = q.trim();
    if (nq.length < 2) return [];
    const result = captureFromText(nq, todayLocal());
    if (!result.title) return [];
    const label =
      result.kind === "task"
        ? t.command.captureTask.replace("{text}", result.title)
        : result.kind === "habit"
          ? t.command.captureHabit.replace("{text}", result.title)
          : result.kind === "focus"
            ? t.command.captureFocus.replace("{n}", formatNumber(locale, result.minutes ?? 25))
            : t.command.captureNote.replace("{text}", result.title);
    const icon =
      result.kind === "task"
        ? ListTodo
        : result.kind === "habit"
          ? Repeat
          : result.kind === "focus"
            ? Timer
            : StickyNote;
    return [
      {
        key: "capture",
        label,
        icon,
        detail: t.command.captureHeading,
        run: () => {
          try {
            onClose();
            if (result.kind === "task") {
              const taskInput: Parameters<typeof tasksApi.add>[0] = { title: result.title };
              if (result.tags.length) taskInput.tags = result.tags;
              if (result.priority) taskInput.priority = result.priority;
              if (result.dueDate) taskInput.dueDate = result.dueDate;
              tasksApi.add(taskInput);
              navigate({ to: "/tasks" });
            } else if (result.kind === "habit") {
              habitsApi.add(result.title, { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] });
              navigate({ to: "/habits" });
            } else if (result.kind === "focus") {
              focusApi.start("custom", result.minutes ?? 25);
              navigate({ to: "/focus" });
            } else {
              notesApi.add({ title: result.title, body: result.body });
              navigate({ to: "/notes" });
            }
          } catch {
            /* ignore */
          }
        },
      },
    ];
  }, [q, t, onClose, navigate, locale]);

  const flat = useMemo(() => [...capture, ...items, ...content], [capture, items, content]);

  useEffect(() => {
    prevFocus.current = document.activeElement;
    inputRef.current?.focus();
    // A dialog closing in the same tick (Radix restores focus to its opener
    // asynchronously) can steal focus right after we take it — re-assert once
    // the dust settles so ⌘K always lands in the input.
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(id);
      (prevFocus.current as HTMLElement | null)?.focus?.();
    };
  }, []);
  useEffect(() => setIdx(0), [q]);

  const go = (i: number) => {
    const item = flat[i];
    if (!item) return;
    item.run();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start justify-center bg-overlay px-4 pt-[15vh] animate-fade"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.command.open}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-popover shadow-elevated animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            setIdx((i) => Math.min(i + 1, flat.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") go(idx);
          else if (e.key === "Tab") e.preventDefault();
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.command.placeholder}
            aria-label={t.command.placeholder}
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul role="listbox" className="max-h-80 overflow-y-auto p-2">
          {flat.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t.command.empty}
            </li>
          )}
          {capture.length > 0 && (
            <li
              role="presentation"
              className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              {t.command.captureHeading}
            </li>
          )}
          {capture.map((n, i) => (
            <li
              key={n.key}
              role="option"
              aria-selected={i === idx}
              onMouseEnter={() => setIdx(i)}
              onClick={() => go(i)}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
            >
              <n.icon className="size-4 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{n.label}</span>
              <ChevronRight className="size-4 opacity-60 rtl-flip" aria-hidden />
            </li>
          ))}
          {items.map((n, i) => {
            const gi = capture.length + i;
            return (
              <li
                key={n.key}
                role="option"
                aria-selected={gi === idx}
                onMouseEnter={() => setIdx(gi)}
                onClick={() => go(gi)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                <n.icon className="size-4" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{n.label}</span>
                <ChevronRight className="size-4 opacity-60 rtl-flip" aria-hidden />
              </li>
            );
          })}
          {content.length > 0 && (
            <li
              role="presentation"
              className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              {t.command.contentHeading}
            </li>
          )}
          {content.map((n, i) => {
            const gi = capture.length + items.length + i;
            return (
              <li
                key={n.key}
                role="option"
                aria-selected={gi === idx}
                onMouseEnter={() => setIdx(gi)}
                onClick={() => go(gi)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                <n.icon className="size-4" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{n.label}</span>
                <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {n.detail}
                </span>
                <ChevronRight className="size-4 opacity-60 rtl-flip" aria-hidden />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
