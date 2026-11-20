import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  BellRing,
  Check,
  Copy,
  Database,
  Download,
  Edit,
  FileWarning,
  Keyboard,
  Monitor,
  Moon,
  MoreVertical,
  RefreshCw,
  Smartphone,
  Sprout,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { usePrefs, type Theme } from "@/components/app/preferences";
import { PageHeader } from "@/components/app/PageHeader";
import { Segmented } from "@/components/app/Segmented";
import { MOBILE_ORDER, MOBILE_BAR_MIN, MOBILE_BAR_MAX, type NavKey } from "@/components/app/nav";
import { Modal } from "@/components/app/Modal";
import { DANGER_BTN, OUTLINE_BTN, PRIMARY_BTN } from "@/components/ui/button";
import { BackupError, parseBackup, type ParsedBackup } from "@/lib/backup";
import { buildZipExport, exportZipFileName } from "@/lib/exportZip";
import { formatDate, formatNumber, type Locale } from "@/lib/i18n";
import { toast } from "sonner";
import { applyUpdate, buildStamp, checkForUpdate, isStandalone, refreshAppFiles } from "@/lib/pwa";
import {
  exportSnapshot,
  flushAll,
  importSnapshot,
  metaActions,
  resetAll,
  seedSampleData,
  settings as settingsApi,
  sync,
  useStore,
  defaultDashboardLayout,
  workspaces,
} from "@/lib/store";
import {
  COLLECTION_KEYS,
  type DashboardCard,
  type Density,
  type RoutePath,
  type SyncSettings,
} from "@/lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Tilth" },
      { name: "description", content: "Language, appearance, your day and your data in Tilth." },
      { property: "og:title", content: "Settings — Tilth" },
      {
        property: "og:description",
        content: "Language, appearance, your day and your data in Tilth.",
      },
    ],
  }),
  component: SettingsPage,
});

const COLLECTIONS = [
  "tasks",
  "notes",
  "habits",
  "habitLogs",
  "focusSessions",
  "xpLedger",
  "achievements",
  "shopItems",
  "purchases",
] as const;
const DAY_START_HOURS = [0, 4] as const;
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const DASHBOARD_CARDS: DashboardCard[] = [
  "priorities",
  "progress",
  "deadlines",
  "habits",
  "focus",
  "level",
  "achievements",
];
const BACKUP_STALE_MS = 7 * 24 * 60 * 60 * 1000;

function SettingsPage() {
  const { t } = usePrefs();

  // TIL-F11: one 888-line scroll becomes eight jump targets. Labels reuse the
  // sections' own legend strings — no new copy to translate.
  const nav: Array<[string, string]> = [
    ["settings-language", t.settings.language],
    ["settings-day", t.settings.yourDay],
    ["settings-theme", t.settings.theme],
    ["settings-cards", t.settings.dashboardCards],
    ["settings-app", t.pwa.sectionTitle],
    ["settings-notifications", t.notif.title],
    ["settings-shortcuts", t.settings.shortcutsTitle],
    ["settings-sync", t.sync.title],
    ["settings-data", t.data.title],
  ];

  return (
    <section>
      <PageHeader title={t.pages.settings.title} lede={t.pages.settings.body} />

      <nav aria-label={t.pages.settings.title} className="-mx-1 mt-5 flex flex-wrap gap-1.5 px-1">
        {nav.map(([id, label]) => (
          <a
            key={id}
            href={"#" + id}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-6 grid items-start gap-4 md:grid-cols-2">
        <LanguageSection />
        <YourDaySection />
        <ThemeSection />
        <DashboardCardsSection />
        <WorkspacesSection />
        <DefaultRouteSection />
        <NavVisibilitySection />
        <AppSection />
        <NotificationsSection />
        <SyncSection />
        <ShortcutsSection />
      </div>

      <div className="mt-4">
        <DataSection />
      </div>

      {/* Debug-only data-layer panel (AGENTS.md) — never shown in production. */}
      {import.meta.env.DEV && (
        <div className="mt-4">
          <StoreStatus />
        </div>
      )}
    </section>
  );
}

function SkeletonPanel() {
  return (
    <fieldset className="panel" aria-busy="true" aria-hidden="true">
      <div className="mt-4 space-y-2">
        <div className="h-5 w-1/3 skeleton" />
        <div className="h-4 w-2/3 skeleton" />
        <div className="h-4 w-1/2 skeleton" />
      </div>
    </fieldset>
  );
}

function LanguageSection() {
  const { t, locale, setLocale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const pick = (l: Locale) => {
    setLocale(l);
    if (ready) settingsApi.update({ language: l });
  };
  return (
    <fieldset id="settings-language" className="panel scroll-mt-6">
      <legend className="panel-title">{t.settings.language}</legend>
      <Segmented
        label={t.settings.language}
        value={locale}
        onChange={(v) => pick(v === "ar" ? "ar" : "en")}
        options={[
          { value: "en", label: "English" },
          { value: "ar", label: "العربية" },
        ]}
      />
    </fieldset>
  );
}

function ThemeSection() {
  const { t, theme, setTheme } = usePrefs();
  const ready = useStore((s) => s.ready);
  const settings = useStore((s) => s.settings);
  const pick = (th: Theme) => {
    setTheme(th);
    if (ready) settingsApi.update({ theme: th });
  };
  const options: Array<{ value: Theme; label: string; icon: ReactNode }> = [
    { value: "light", label: t.settings.light, icon: <Sun className="size-4" aria-hidden /> },
    { value: "dark", label: t.settings.dark, icon: <Moon className="size-4" aria-hidden /> },
    { value: "system", label: t.settings.system, icon: <Monitor className="size-4" aria-hidden /> },
  ];
  return (
    <fieldset id="settings-theme" className="panel scroll-mt-6">
      <legend className="panel-title">{t.settings.theme}</legend>
      <Segmented
        label={t.settings.theme}
        value={theme}
        onChange={(v) => pick(v as Theme)}
        options={options}
      />
      {theme === "system" && (
        <p className="mt-3 text-xs text-muted-foreground">{t.settings.systemHint}</p>
      )}
      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="text-sm">{t.settings.reducedMotion}</span>
        <Switch
          checked={settings.reducedMotion ?? false}
          onChange={(v) => settingsApi.update({ reducedMotion: v })}
          label={t.settings.reducedMotion}
        />
      </div>
    </fieldset>
  );
}

function YourDaySection() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const settings = useStore((s) => s.settings);
  const [draft, setDraft] = useState(String(settings.dailyFocusTargetMinutes));

  useEffect(() => {
    setDraft(String(settings.dailyFocusTargetMinutes));
  }, [settings.dailyFocusTargetMinutes]);

  if (!ready) return <SkeletonPanel />;

  const commitTarget = () => {
    const n = Math.min(1440, Math.max(0, Math.round(Number(draft) || 0)));
    setDraft(String(n));
    if (n !== settings.dailyFocusTargetMinutes) settingsApi.update({ dailyFocusTargetMinutes: n });
  };

  return (
    <fieldset id="settings-day" className="panel scroll-mt-6">
      <legend className="panel-title">{t.settings.yourDay}</legend>

      <div className="mt-2">
        <p className="text-sm font-medium">{t.settings.dayStart}</p>
        <p className="text-xs text-muted-foreground">{t.settings.dayStartHint}</p>
        <Segmented
          label={t.settings.dayStart}
          value={String(settings.dayStartHour)}
          onChange={(v) => settingsApi.update({ dayStartHour: v === "4" ? 4 : 0 })}
          options={DAY_START_HOURS.map((h) => ({ value: String(h), label: dayHourLabel(h) }))}
        />
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium">{t.settings.weekStart}</p>
        <div
          className="mt-2 grid max-w-sm grid-cols-4 gap-1.5 sm:grid-cols-7"
          role="radiogroup"
          aria-label={t.settings.weekStart}
        >
          {WEEKDAYS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={settings.weekStartsOn === d}
              onClick={() => settingsApi.update({ weekStartsOn: d })}
              className="segment justify-center"
            >
              {weekdayShort(locale, d)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="focus-target" className="text-sm font-medium">
          {t.settings.focusTarget}
        </label>
        <div className="mt-2 flex items-center gap-2">
          <input
            id="focus-target"
            type="number"
            inputMode="numeric"
            min={0}
            max={1440}
            step={5}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitTarget}
            className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-sm tabular-nums text-foreground"
          />
          <span className="text-sm text-muted-foreground">{t.settings.minutes}</span>
        </div>
      </div>
    </fieldset>
  );
}

function DashboardCardsSection() {
  const { t } = usePrefs();
  const ready = useStore((s) => s.ready);
  const cards = useStore((s) => s.settings.dashboardCards);
  const savedLayout = useStore((s) => s.settings.dashboardLayout);
  const layout = savedLayout ?? defaultDashboardLayout();
  if (!ready) return <SkeletonPanel />;

  const move = (from: number, to: number) => {
    const prev = layout.cardOrder.join(",");
    const next = [...layout.cardOrder];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    settingsApi.update({ dashboardLayout: { ...layout, cardOrder: next } });
    toast(t.settings.orderChanged, {
      action: {
        label: t.settings.undo,
        onClick: () =>
          settingsApi.update({
            dashboardLayout: { ...layout, cardOrder: prev.split(",") as DashboardCard[] },
          }),
      },
    });
  };

  return (
    <fieldset id="settings-cards" className="panel scroll-mt-6">
      <legend className="panel-title">{t.settings.dashboardCards}</legend>
      <p className="text-xs text-muted-foreground">{t.settings.dashboardHint}</p>

      <div className="mt-4">
        <p className="text-sm font-medium">Density</p>
        <Segmented
          label={t.settings.density}
          value={layout.density}
          onChange={(v) => {
            const prev = layout.density;
            settingsApi.update({
              dashboardLayout: { ...layout, density: v as Density },
            });
            toast(t.settings.densityChanged, {
              action: {
                label: t.settings.undo,
                onClick: () =>
                  settingsApi.update({
                    dashboardLayout: { ...layout, density: prev },
                  }),
              },
            });
          }}
          options={[
            { value: "comfortable", label: t.settings.densityComfortable },
            { value: "compact", label: t.settings.densityCompact },
          ]}
        />
      </div>

      <ul className="mt-6 space-y-1">
        {DASHBOARD_CARDS.map((c) => {
          const visible = cards[c];
          const pos = layout.cardOrder.indexOf(c);
          const shown = pos >= 0;
          return (
            <li
              key={c}
              className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/20"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm">{t.settings.cards[c]}</span>
                <Switch
                  checked={visible}
                  onChange={(v) => {
                    const prevCards = { ...cards };
                    settingsApi.update({ dashboardCards: { ...cards, [c]: v } });
                    toast(t.settings.cardToggled.replace("{name}", t.settings.cards[c]), {
                      action: {
                        label: t.settings.undo,
                        onClick: () => settingsApi.update({ dashboardCards: prevCards }),
                      },
                    });
                  }}
                  label={t.settings.cards[c]}
                />
                {shown && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => pos > 0 && move(pos, pos - 1)}
                      disabled={pos <= 0}
                      aria-label={`Move ${t.settings.cards[c]} up`}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/40 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <ArrowUp className="size-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => pos < layout.cardOrder.length - 1 && move(pos, pos + 1)}
                      disabled={pos >= layout.cardOrder.length - 1}
                      aria-label={`Move ${t.settings.cards[c]} down`}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/40 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <ArrowDown className="size-3.5" aria-hidden />
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function WorkspacesSection() {
  const { t } = usePrefs();
  const ready = useStore((s) => s.ready);
  const settings = useStore((s) => s.settings);
  const list = settings.workspaces ?? [];
  const activeId = settings.activeWorkspaceId;
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  if (!ready) return <SkeletonPanel />;

  const saveCurrent = () => {
    if (workspaces.add(newName.trim())) {
      setSaving(false);
      setNewName("");
    }
  };

  const switchWs = (id: string) => {
    workspaces.switchTo(id);
    toast(t.settings.workspaces.switched);
  };

  const commitRename = () => {
    if (!renamingId) return;
    if (renameDraft.trim()) workspaces.rename(renamingId, renameDraft.trim());
    setRenamingId(null);
  };

  return (
    <fieldset id="settings-workspaces" className="panel scroll-mt-6">
      <legend className="panel-title">{t.settings.workspaces.title}</legend>
      <p className="text-xs text-muted-foreground">{t.settings.workspaces.hint}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t.settings.workspaces.namePlaceholder}
          className="h-9 flex-1 min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none"
        />
        <button
          type="button"
          disabled={saving || !newName.trim()}
          onClick={saveCurrent}
          className={PRIMARY_BTN + " px-3 py-1.5"}
        >
          {t.settings.workspaces.save}
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {list.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t.settings.workspaces.empty}</p>
        ) : (
          list.map((w) => {
            const active = activeId === w.id;
            return (
              <li
                key={w.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/30 p-2"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {renamingId === w.id ? (
                    <input
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      defaultValue={w.name}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitRename();
                        } else if (e.key === "Escape") {
                          setRenamingId(null);
                        }
                      }}
                      className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none"
                      autoFocus
                    />
                  ) : (
                    <span className="truncate">
                      {w.name}
                      {active ? ` · ${t.settings.workspaces.active}` : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!active && (
                    <button
                      type="button"
                      onClick={() => switchWs(w.id)}
                      aria-label={`${t.settings.workspaces.switch}: ${w.name}`}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/40"
                    >
                      {t.settings.workspaces.switch}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRenameDraft(w.name);
                      setRenamingId(w.id);
                    }}
                    aria-label={`${t.settings.workspaces.rename}: ${w.name}`}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/40"
                  >
                    <Edit className="size-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const copy = workspaces.duplicate(w.id);
                      if (copy) toast(t.settings.workspaces.duplicated);
                    }}
                    aria-label={`${t.settings.workspaces.duplicate}: ${w.name}`}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/40"
                  >
                    <Copy className="size-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => workspaces.remove(w.id)}
                    aria-label={`${t.settings.workspaces.delete}: ${w.name}`}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <div className="mt-5 border-t border-border/60 pt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => workspaces.reset()}
          className="text-xs text-destructive underline underline-offset-4 hover:text-destructive/80"
        >
          {t.settings.workspaces.reset}
        </button>
        <p className="text-xs text-muted-foreground">{t.settings.workspaces.resetHint}</p>
      </div>
    </fieldset>
  );
}

const ROUTE_CHOICES: [RoutePath, string][] = [
  ["/", "dashboard"],
  ["/plan", "plan"],
  ["/calendar", "calendar"],
  ["/tasks", "tasks"],
  ["/notes", "notes"],
  ["/habits", "habits"],
  ["/focus", "focus"],
  ["/rewards", "rewards"],
  ["/insights", "insights"],
  ["/settings", "settings"],
];

function DefaultRouteSection() {
  const { t } = usePrefs();
  const ready = useStore((s) => s.ready);
  const settings = useStore((s) => s.settings);
  if (!ready) return <SkeletonPanel />;
  const route = settings.defaultRoute ?? "/";

  return (
    <fieldset id="settings-default-route" className="panel scroll-mt-6">
      <legend className="panel-title">{t.settings.defaultRoute}</legend>
      <p className="text-xs text-muted-foreground">{t.settings.defaultRouteHint}</p>
      <div className="mt-2">
        <select
          value={route}
          onChange={(e) => settingsApi.update({ defaultRoute: e.target.value as RoutePath })}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none"
        >
          {ROUTE_CHOICES.map(([path, labelKey]) => (
            <option key={path} value={path}>
              {t.nav[labelKey as keyof typeof t.nav]}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}

function NavVisibilitySection() {
  const { t } = usePrefs();
  const ready = useStore((s) => s.ready);
  const settings = useStore((s) => s.settings);
  const hidden = settings.navVisibility ?? {};
  const userOrder: NavKey[] = (settings.navOrder ?? [...MOBILE_ORDER]) as NavKey[];
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const visibleKeys = userOrder.filter((key) => hidden[key] !== false);
  const atMinimum = visibleKeys.length <= MOBILE_BAR_MIN;
  const atMaximum = visibleKeys.length >= MOBILE_BAR_MAX;
  if (!ready) return <SkeletonPanel />;

  return (
    <fieldset id="settings-nav-visibility" className="panel scroll-mt-6">
      <legend className="panel-title">{t.settings.navVisibility}</legend>
      <p className="text-xs text-muted-foreground">{t.settings.navVisibilityHint}</p>
      {atMinimum && <p className="mt-1 mb-3 text-xs text-warning">{t.settings.navVisibilityMin}</p>}
      <ul className="mt-3 space-y-2">
        {userOrder.map((key, index) => {
          const isVisible = hidden[key] !== false;
          const disabled = (atMinimum && isVisible) || (atMaximum && !isVisible);
          const isDragging = draggedIndex === index;
          return (
            <li
              key={key}
              className={
                "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/100" +
                (disabled ? " opacity-50" : "") +
                (isDragging ? " bg-accent/20 border border-accent" : " border-transparent")
              }
            >
              <div
                className="flex items-center gap-3 cursor-grab active:cursor-select p-2"
                onDragStart={(e) => {
                  setDraggedIndex(index);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(index));
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (draggedIndex !== null && draggedIndex !== index) {
                    const next = [...userOrder];
                    const [removed] = next.splice(draggedIndex!, 1);
                    next.splice(index, 0, removed!);
                    settingsApi.update({ navOrder: next });
                    setDraggedIndex(index);
                  }
                }}
                onDragEnd={() => setDraggedIndex(null)}
                draggable
              >
                <MoreVertical className="size-8 text-muted-foreground" aria-hidden />
              </div>
              <span className="text-sm truncate flex-1">{t.nav[key as keyof typeof t.nav]}</span>
              <Switch
                checked={isVisible}
                onChange={(v) => {
                  if (disabled) return;
                  const prevHidden = { ...hidden };
                  settingsApi.update({
                    navVisibility: { ...hidden, [key]: v },
                  });
                  toast(
                    v
                      ? t.settings.navShown.replace("{name}", t.nav[key as keyof typeof t.nav])
                      : t.settings.navHidden.replace("{name}", t.nav[key as keyof typeof t.nav]),
                    {
                      action: {
                        label: t.settings.undo,
                        onClick: () => settingsApi.update({ navVisibility: prevHidden }),
                      },
                    },
                  );
                }}
                label={t.nav[key as keyof typeof t.nav]}
              />
              {disabled && (
                <span className="text-xs text-warning" title={t.settings.navVisibilityMin}>
                  ⚠
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

type InstallPromptEvent = {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Install app (PWA) — uses beforeinstallprompt where supported. */
function AppSection() {
  const { t } = usePrefs();
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [checking, setChecking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as unknown as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    setInstalled(isStandalone());
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  };

  return (
    <fieldset id="settings-app" className="panel scroll-mt-6">
      <legend className="panel-title">{t.pwa.sectionTitle}</legend>
      <p className="text-sm text-muted-foreground">{t.pwa.installBody}</p>
      {installed ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary">
          <Check className="size-4" aria-hidden /> {t.pwa.installed}
        </p>
      ) : promptEvent ? (
        <button type="button" onClick={() => void install()} className={PRIMARY_BTN + " mt-3"}>
          <Smartphone className="size-4" aria-hidden /> {t.pwa.install}
        </button>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{t.pwa.installUnsupported}</p>
      )}
      <div className="mt-4 border-t border-border/60 pt-3">
        <button
          type="button"
          disabled={checking}
          onClick={() => {
            setChecking(true);
            void checkForUpdate()
              .then((res) => {
                if (res === "ready") {
                  toast(t.pwa.updateAvailable, {
                    action: { label: t.pwa.reload, onClick: () => applyUpdate() },
                  });
                } else if (res === "current") {
                  toast(t.pwa.upToDate);
                } else {
                  toast(t.pwa.updatePublishedOnly);
                }
              })
              .finally(() => setChecking(false));
          }}
          className={OUTLINE_BTN + " px-3 py-1.5"}
        >
          <RefreshCw className={"size-4" + (checking ? " animate-spin" : "")} aria-hidden />
          {t.pwa.checkUpdate}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">{t.pwa.updateHint}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              void refreshAppFiles().then((ok) => {
                if (ok) {
                  window.location.reload();
                } else {
                  setRefreshing(false);
                  toast(t.pwa.updatePublishedOnly);
                }
              });
            }}
            className={OUTLINE_BTN + " px-3 py-1.5"}
          >
            <Download className={"size-4" + (refreshing ? " animate-spin" : "")} aria-hidden />
            {t.pwa.refreshFiles}
          </button>
          <span className="chip font-mono text-[10px]" title={t.pwa.buildLabel}>
            {t.pwa.buildLabel + " " + buildStamp()}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t.pwa.refreshHint}</p>
      </div>
    </fieldset>
  );
}

/** Quiet daily digest — off by default; local notifications while the app is open. */
function NotificationsSection() {
  const { t } = usePrefs();
  const ready = useStore((s) => s.ready);
  const digest = useStore((s) => s.settings.digest);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");

  // Read the browser permission after mount (no hydration drift).
  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  if (!ready) return <SkeletonPanel />;

  const enabled = digest?.enabled ?? false;
  const morningAt = digest?.morningAt ?? "08:00";
  const eveningAt = digest?.eveningAt ?? "21:00";

  const askPermission = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
  };

  return (
    <fieldset id="settings-notifications" className="panel scroll-mt-6">
      <legend className="panel-title">{t.notif.title}</legend>
      <p className="text-xs text-muted-foreground">{t.notif.hint}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t.notif.whileOpen}</p>
      <div className="mt-3 flex items-center justify-between gap-4">
        <span className="text-sm">{enabled ? t.notif.on : t.notif.off}</span>
        <Switch
          checked={enabled}
          onChange={(v) => settingsApi.update({ digest: { enabled: v, morningAt, eveningAt } })}
          label={t.notif.title}
        />
      </div>
      <div className="mt-3">
        {perm === "granted" ? (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
            <Check className="size-3.5" aria-hidden /> {t.notif.on}
          </p>
        ) : perm === "denied" ? (
          <p className="text-xs text-destructive">{t.notif.denied}</p>
        ) : perm === "unsupported" ? null : (
          <button
            type="button"
            onClick={() => void askPermission()}
            className={OUTLINE_BTN + " px-3 py-1.5"}
          >
            <BellRing className="size-4" aria-hidden /> {t.notif.allow}
          </button>
        )}
      </div>
    </fieldset>
  );
}

/** Remote sync configuration — the passphrase never leaves this device. */
function SyncSection() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const settings = useStore((s) => s.settings);
  const st = settings.sync;
  const enabled = st?.enabled ?? false;
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "ok" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!ready) return <SkeletonPanel />;

  const commit = async () => {
    setSyncStatus("syncing");
    setStatusMsg(null);
    try {
      // Pull first: merge the remote replica into local data, then push the
      // merged result. Pushing first would overwrite remote-only records.
      const pulled = await sync.pull();
      if (!pulled.ok) {
        setSyncStatus("error");
        setStatusMsg(t.sync.error.replace("{message}", pulled.error ?? ""));
        return;
      }
      const pushed = await sync.push();
      if (!pushed.ok) {
        setSyncStatus("error");
        setStatusMsg(t.sync.error.replace("{message}", pushed.error ?? ""));
        return;
      }
      setSyncStatus("ok");
      setStatusMsg(
        pulled.conflicts && pulled.conflicts > 0 ? t.sync.conflictsHint : t.sync.upToDate,
      );
    } catch (err) {
      // A thrown transport error must never leave the button stuck "syncing".
      setSyncStatus("error");
      setStatusMsg(t.sync.error.replace("{message}", err instanceof Error ? err.message : ""));
    }
  };

  const conflicts = st?.conflicts ?? [];

  return (
    <fieldset id="settings-sync" className="panel scroll-mt-6">
      <legend className="panel-title">{t.sync.title}</legend>
      <p className="text-xs text-muted-foreground">{t.sync.body}</p>
      <div className="mt-3 flex items-center justify-between gap-4">
        <span className="text-sm">{enabled ? t.sync.on : t.sync.off}</span>
        <Switch
          checked={enabled}
          onChange={(v) =>
            settingsApi.update({ sync: { ...(st ?? defaultSyncInSettings()), enabled: v } })
          }
          label={t.sync.enable}
        />
      </div>

      {enabled && (
        <>
          <div className="mt-4 space-y-2">
            <label className="block text-xs font-medium text-foreground">{t.sync.endpoint}</label>
            <input
              value={st?.endpoint ?? ""}
              onChange={(e) =>
                settingsApi.update({
                  sync: { ...(st ?? defaultSyncInSettings()), endpoint: e.target.value },
                })
              }
              placeholder="https://my-server.example/api/sync"
              className="input"
            />
            <p className="text-xs text-muted-foreground">{t.sync.endpointHint}</p>
          </div>
          <div className="mt-4 space-y-2">
            <label className="block text-xs font-medium text-foreground">{t.sync.passphrase}</label>
            <input
              type="password"
              value={st?.passphrase ?? ""}
              onChange={(e) =>
                settingsApi.update({
                  sync: { ...(st ?? defaultSyncInSettings()), passphrase: e.target.value },
                })
              }
              placeholder="••••••••"
              className="input"
            />
            <p className="text-xs text-muted-foreground">{t.sync.passphraseHint}</p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              disabled={syncStatus === "syncing"}
              onClick={commit}
              className={PRIMARY_BTN + " px-4 py-2 text-sm"}
            >
              <RefreshCw className="size-4 shrink-0" aria-hidden />
              {syncStatus === "syncing" ? t.sync.syncing : t.sync.syncNow}
            </button>
            <span className="ms-auto text-xs text-muted-foreground">
              {t.sync.lastSync}:{" "}
              {st?.lastSyncedAt ? formatDate(locale, new Date(st.lastSyncedAt)) : t.sync.never}
            </span>
          </div>
          {statusMsg && (
            <p className="mt-2 text-sm">
              {syncStatus === "error" ? (
                <span className="text-destructive">{statusMsg}</span>
              ) : syncStatus === "ok" ? (
                <span className="text-primary">{statusMsg}</span>
              ) : (
                statusMsg
              )}
            </p>
          )}
          {conflicts.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">{t.sync.conflicts}</p>
              <p className="text-xs text-muted-foreground">{t.sync.conflictsHint}</p>
              {conflicts.map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                  <div className="mb-1 truncate text-muted-foreground">
                    {c.collection}:{c.recordId} ({c.reason})
                  </div>
                  <details className="mb-2">
                    <summary className="cursor-pointer text-xs font-medium text-primary">
                      {t.sync.compare}
                    </summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="min-w-0">
                        <p className="mb-1 text-xs font-semibold text-muted-foreground">
                          {t.sync.keepLocal}
                        </p>
                        <pre className="max-h-40 overflow-auto rounded-md border border-border bg-background p-2 font-mono text-[11px] leading-4">
                          {JSON.stringify(c.local, null, 2)}
                        </pre>
                      </div>
                      <div className="min-w-0">
                        <p className="mb-1 text-xs font-semibold text-muted-foreground">
                          {t.sync.keepRemote}
                        </p>
                        <pre className="max-h-40 overflow-auto rounded-md border border-border bg-background p-2 font-mono text-[11px] leading-4">
                          {JSON.stringify(c.remote, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </details>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => sync.resolve(c.id, "local")}
                      className="flex-1 py-1.5 px-2 text-xs border border-border rounded hover:bg-accent/40"
                    >
                      {t.sync.keepLocal}
                    </button>
                    <button
                      type="button"
                      onClick={() => sync.resolve(c.id, "remote")}
                      className="flex-1 py-1.5 px-2 text-xs border border-border rounded hover:bg-accent/40"
                    >
                      {t.sync.keepRemote}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}

function defaultSyncInSettings(): SyncSettings {
  return { enabled: false, endpoint: "", deviceId: crypto.randomUUID() };
}

/** The keyboard shortcuts that exist, documented where they live. */
function ShortcutsSection() {
  const { t } = usePrefs();
  const rows: Array<[string, string]> = [
    [t.settings.shortcuts.palette, "Ctrl/⌘ K"],
    [t.settings.shortcuts.focusStart, "Space"],
    [t.settings.shortcuts.escape, "Esc"],
  ];
  return (
    <fieldset id="settings-shortcuts" className="panel scroll-mt-6">
      <legend className="panel-title">{t.settings.shortcutsTitle}</legend>
      <ul className="mt-3 space-y-1.5 text-sm">
        {rows.map(([label, keys]) => (
          <li key={label} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">
              <Keyboard className="me-1.5 inline size-3.5" aria-hidden />
              {label}
            </span>
            <kbd className="rounded border border-border bg-accent/40 px-1.5 py-0.5 font-sans text-xs">
              {keys}
            </kbd>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function DataSection() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const persisted = useStore((s) => s.persisted);
  const lastExportedAt = useStore((s) => s.meta.lastExportedAt);
  const [flash, setFlash] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetWord, setResetWord] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 6000);
    return () => window.clearTimeout(id);
  }, [flash]);

  if (!ready) return <SkeletonPanel />;

  const stale =
    !lastExportedAt || Date.now() - new Date(lastExportedAt).getTime() > BACKUP_STALE_MS;

  const doExport = () => {
    const blob = new Blob([buildZipExport(exportSnapshot())], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportZipFileName();
    a.click();
    URL.revokeObjectURL(url);
    metaActions.update({ lastExportedAt: new Date().toISOString() });
    setFlash(t.data.exportDone);
  };

  const onFile = async (f: File) => {
    try {
      setPending(parseBackup(await f.text()));
      setImportErr(null);
    } catch (e) {
      setPending(null);
      setImportErr(
        e instanceof BackupError
          ? e.code === "newer-schema"
            ? t.data.errNewer
            : e.code === "empty"
              ? t.data.errEmpty
              : t.data.errInvalid
          : t.data.errInvalid,
      );
    }
  };

  const confirmImport = async () => {
    if (!pending) return;
    const snap = pending.snapshot;
    setPending(null);
    try {
      await importSnapshot(snap);
      setFlash(t.data.importDone);
    } catch {
      setFlash(t.data.importFailed);
    }
  };

  return (
    <>
      <fieldset id="settings-data" className="panel scroll-mt-6">
        <legend className="panel-title">{t.data.title}</legend>
        <p className="text-sm text-muted-foreground">{t.data.localOnly}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t.data.backupWhy}</p>

        <div className="mt-3 flex items-center justify-between gap-4 border-b border-border/60 py-1.5 text-sm">
          <span className="text-muted-foreground">{t.data.persisted}</span>
          <span className="font-medium">
            {persisted === null ? t.debug.unknown : persisted ? t.data.granted : t.data.notGranted}
          </span>
        </div>

        {stale && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-accent/60 bg-accent/20 px-4 py-3">
            <div className="flex items-start gap-2">
              <FileWarning className="mt-0.5 size-4 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">{t.data.reminderTitle}</p>
                <p className="text-xs text-muted-foreground">{t.data.reminderBody}</p>
              </div>
            </div>
            <button type="button" onClick={doExport} className={OUTLINE_BTN}>
              {t.data.exportBtn}
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={doExport} className={PRIMARY_BTN}>
            <Download className="size-4" aria-hidden /> {t.data.export}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className={OUTLINE_BTN}>
            <Upload className="size-4" aria-hidden /> {t.data.import}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t.data.exportHint}</p>
        <p className="text-xs text-muted-foreground">{t.data.importHint}</p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void onFile(f);
          }}
        />

        {importErr && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {importErr}
          </p>
        )}
        {flash && (
          <p className="mt-3 text-sm font-medium text-primary" role="status">
            {flash}
          </p>
        )}

        <div className="mt-5 border-t border-border/60 pt-4">
          <button
            type="button"
            onClick={() => {
              setResetWord("");
              setResetOpen(true);
            }}
            className={DANGER_BTN}
          >
            {t.data.reset}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">{t.data.resetHint}</p>
        </div>
      </fieldset>

      {pending && (
        <Modal title={t.data.importTitle} onClose={() => setPending(null)}>
          <h2 className="font-display text-lg font-semibold">{t.data.importTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.data.importBody}</p>
          {pending.exportedAt && (
            <p className="mt-3 text-sm font-medium">
              {t.data.importFrom.replace(
                "{date}",
                formatDate(locale, new Date(pending.exportedAt), { dateStyle: "medium" }),
              )}
            </p>
          )}
          {pending.migratedFrom !== null && (
            <p className="mt-1 text-xs text-muted-foreground">{t.data.migratedNote}</p>
          )}
          <ul className="mt-3 space-y-1 text-sm">
            {COLLECTION_KEYS.map((c) => (
              <li key={c} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t.data.collections[c]}</span>
                <span className="font-medium tabular-nums">
                  {formatNumber(locale, pending.counts[c])}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setPending(null)} className={OUTLINE_BTN}>
              {t.data.cancel}
            </button>
            <button type="button" onClick={() => void confirmImport()} className={PRIMARY_BTN}>
              {t.data.replaceBtn}
            </button>
          </div>
        </Modal>
      )}

      {resetOpen && (
        <Modal title={t.data.resetTitle} onClose={() => setResetOpen(false)}>
          <h2 className="font-display text-lg font-semibold">{t.data.resetTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.data.resetBody}</p>
          <button type="button" onClick={doExport} className={OUTLINE_BTN + " mt-4 w-full"}>
            <Download className="size-4" aria-hidden /> {t.data.resetExportFirst}
          </button>
          <label htmlFor="reset-confirm" className="mt-4 block text-sm font-medium">
            {t.data.resetWordPrompt}
          </label>
          <input
            id="reset-confirm"
            value={resetWord}
            onChange={(e) => setResetWord(e.target.value)}
            autoComplete="off"
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setResetOpen(false)} className={OUTLINE_BTN}>
              {t.data.cancel}
            </button>
            <button
              type="button"
              disabled={resetWord.trim() !== t.data.resetWord}
              onClick={() => {
                setResetOpen(false);
                void resetAll();
              }}
              className={DANGER_BTN}
            >
              {t.data.resetBtn}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border transition-colors disabled:cursor-not-allowed disabled:opacity-50 " +
        (checked ? "bg-primary" : "bg-muted")
      }
    >
      <span
        aria-hidden
        className={
          // Logical rest position (start-0.5) + direction-aware travel:
          // mirroring the root (rtl-flip) while translating physically threw
          // the thumb outside the track in RTL. No mirror, no magic offsets.
          "pointer-events-none absolute start-0.5 block size-4 rounded-full bg-background shadow transition-transform " +
          (checked ? "translate-x-[22px] rtl:-translate-x-[22px]" : "translate-x-0")
        }
      />
    </button>
  );
}

/** Temporary debug view of the data layer. */
function StoreStatus() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const error = useStore((s) => s.error);
  const persisted = useStore((s) => s.persisted);
  const schemaVersion = useStore((s) => s.meta.schemaVersion);
  const pending = useStore((s) => s.pending);
  const lastSyncAt = useStore((s) => s.lastSyncAt);
  const lastMergeAt = useStore((s) => s.lastMergeAt);
  const settings = useStore((s) => s.settings);

  if (!ready) {
    return (
      <fieldset className="panel" aria-busy="true">
        <legend className="panel-title">{t.debug.title}</legend>
        <div className="mt-4 space-y-2" aria-hidden="true">
          <div className="h-4 w-2/3 skeleton" />
          <div className="h-4 w-1/2 skeleton" />
          <div className="h-4 w-3/5 skeleton" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t.debug.loading}</p>
      </fieldset>
    );
  }

  const rows: Array<[string, string]> = [
    [t.debug.schema, formatNumber(locale, schemaVersion)],
    [
      t.debug.storage,
      persisted === null ? t.debug.unknown : persisted ? t.debug.granted : t.debug.notGranted,
    ],
    [t.debug.dayStart, dayHourLabel(settings.dayStartHour)],
    [t.debug.weekStart, weekdayName(locale, settings.weekStartsOn)],
    [
      t.debug.focusTarget,
      formatNumber(locale, settings.dailyFocusTargetMinutes) + " " + t.debug.minutes,
    ],
    [t.debug.pending, formatNumber(locale, pending.length)],
    [
      t.debug.lastSync,
      lastSyncAt
        ? formatDate(locale, new Date(lastSyncAt), { dateStyle: "short", timeStyle: "medium" })
        : t.debug.never,
    ],
    [
      t.debug.lastMerge,
      lastMergeAt
        ? formatDate(locale, new Date(lastMergeAt), { dateStyle: "short", timeStyle: "medium" })
        : t.debug.never,
    ],
  ];

  return (
    <details id="settings-store" className="panel group scroll-mt-6">
      <summary className="panel-title -mx-1 cursor-pointer list-none px-1 py-1">
        <span className="inline-flex items-center gap-2">
          <svg
            viewBox="0 0 16 16"
            className="size-3.5 transition-transform group-open:rotate-90 rtl-flip"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 3l6 5-6 5" />
          </svg>
          {t.debug.title}
        </span>
      </summary>
      <dl className="mt-3 grid gap-x-8 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <Row key={label} label={label} value={value} />
        ))}
      </dl>

      <table className="mt-5 w-full text-sm">
        <caption className="sr-only">{t.debug.collections}</caption>
        <thead>
          <tr className="text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="py-1 text-start font-medium">
              {t.debug.collections}
            </th>
            <th scope="col" className="py-1 text-end font-medium">
              {t.debug.records}
            </th>
            <th scope="col" className="py-1 text-end font-medium">
              {t.debug.softDeleted}
            </th>
          </tr>
        </thead>
        <tbody>
          {COLLECTIONS.map((c) => (
            <CollectionCount key={c} collection={c} locale={locale} />
          ))}
        </tbody>
      </table>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {import.meta.env.DEV && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => seedSampleData()}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/40"
          >
            <Sprout className="size-4" aria-hidden />
            {t.debug.seed}
          </button>
          <button
            type="button"
            onClick={() => void flushAll()}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/40"
          >
            <Database className="size-4" aria-hidden />
            {t.debug.flush}
          </button>
        </div>
      )}
    </details>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function CollectionCount({
  collection,
  locale,
}: {
  collection: (typeof COLLECTIONS)[number];
  locale: Locale;
}) {
  const list = useStore((s) => s[collection]);
  const live = list.filter((r) => !r.deletedAt).length;
  const soft = list.length - live;
  return (
    <tr className="border-t border-border">
      <td className="py-1.5">{collection}</td>
      <td className="py-1.5 text-end tabular-nums">{formatNumber(locale, live)}</td>
      <td className="py-1.5 text-end tabular-nums">
        {soft > 0 ? formatNumber(locale, soft) : "—"}
      </td>
    </tr>
  );
}

function dayHourLabel(hour: number): string {
  return String(hour).padStart(2, "0") + ":00";
}

function weekdayName(locale: Locale, weekStartsOn: number): string {
  // 2023-01-01 was a Sunday, so the 1st + weekStartsOn lands on that weekday.
  const day = new Date(Date.UTC(2023, 0, 1 + weekStartsOn));
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(day);
}

function weekdayShort(locale: Locale, d: number): string {
  const day = new Date(Date.UTC(2023, 0, 1 + d));
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(day);
}
