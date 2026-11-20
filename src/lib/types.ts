/** Schema entity types. Bump CURRENT_SCHEMA_VERSION + add a migration when changing. */
export const CURRENT_SCHEMA_VERSION = 5;

export type ISODate = string; // full ISO timestamp
export type LocalDay = string; // 'YYYY-MM-DD', stored at creation, never recomputed

export interface BaseRecord {
  id: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt?: ISODate | undefined;
}

export type Priority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "doing" | "done";

export interface RecurrenceRule {
  freq: "daily" | "weekly" | "monthly";
  interval: number; // every N units, >= 1
  byWeekday?: number[] | undefined; // 0=Sun..6=Sat, weekly only
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task extends BaseRecord {
  title: string;
  notes?: string | undefined;
  priority: Priority;
  dueDate?: LocalDay | undefined;
  tags: string[];
  subtasks: Subtask[];
  status: TaskStatus;
  completedAt?: ISODate | undefined;
  recurrence?: RecurrenceRule | undefined;
  /** Identifies one recurring series; generated instances inherit it (additive optional field). */
  seriesId?: string | undefined;
  /** Time-block start, minutes from midnight, pinned by the user on /plan (additive optional). */
  blockStart?: number | undefined;
  kanbanOrder: number;
}

export interface HabitSchedule {
  type: "daily" | "weekly" | "custom";
  days: number[]; // 0=Sun..6=Sat
}

export interface Habit extends BaseRecord {
  name: string;
  schedule: HabitSchedule;
  archived: boolean;
  /** Streak freeze window end: scheduled days inside it neither break nor extend (additive optional). */
  pausedUntil?: LocalDay | undefined;
  /** Streak freeze window start (the day freeze was set); additive optional. */
  pausedFrom?: LocalDay | undefined;
}

export interface HabitLog extends BaseRecord {
  habitId: string;
  localDay: LocalDay;
  status: "done" | "skipped";
}

export interface FocusSession extends BaseRecord {
  mode: "pomodoro" | "custom" | "break";
  plannedMinutes: number;
  startedAt: ISODate;
  endsAt: ISODate;
  endedAt?: ISODate | undefined;
  /** Set while the countdown is frozen; cleared when endsAt is shifted on resume. */
  pausedAt?: ISODate | undefined;
  completed: boolean;
  distractions: { at: ISODate }[];
  linkedTaskId?: string | undefined;
  localDay: LocalDay;
}

export interface XpLedgerEntry extends BaseRecord {
  sourceType: "task" | "habit" | "focus" | "challenge" | "achievement" | "shop";
  sourceId: string;
  localDay: LocalDay;
  xp: number;
  coins: number;
}

/** An achievement unlocked once; written by the store after reward checks. */
export interface AchievementUnlock extends BaseRecord {
  achievementId: string;
  unlockedAt: ISODate;
  localDay: LocalDay;
}

/** Unlockable accent themes â€” hue sets live in src/styles.css, unlock rules in rewardsConfig. */
export const ACCENT_IDS = [
  "moss",
  "sage",
  "pine",
  "clay",
  "dusk",
  "sand",
  "sky",
  "ember",
  "orchid",
  "tide",
] as const;
export type AccentId = (typeof ACCENT_IDS)[number];

/** A user-defined reward the user can buy with coins. */
export interface ShopItem extends BaseRecord {
  name: string;
  note?: string | undefined;
  /** Coin price â€” a positive integer. */
  price: number;
  /** Preset category id from SHOP_CATEGORIES (additive optional). */
  category?: string | undefined;
}

/**
 * One purchase. The matching xpLedger entry (sourceType "shop",
 * sourceId = id, coins = -price, xp 0) carries the spent coins; this
 * record keeps the history and the used/refunded state. name and price
 * are snapshots at buy time, so deleting the item never rewrites
 * history. Soft-delete marks a refund (same localDay, unused only).
 */
export interface Purchase extends BaseRecord {
  itemId: string;
  name: string;
  price: number;
  localDay: LocalDay;
  /** Set when the user redeems the purchase themselves. */
  usedAt?: ISODate | undefined;
}

/** A free-form Markdown note â€” thoughts, plans and links. Notes sit outside the XP economy. */
export interface Note extends BaseRecord {
  title: string;
  body: string;
  /** Optional link to a task this note belongs to. */
  linkedTaskId?: string | undefined;
  pinned?: boolean | undefined;
}

export type DashboardCard =
  "priorities" | "progress" | "deadlines" | "habits" | "focus" | "level" | "achievements";

/** Application route paths, used for the default landing-page preference. */
export type RoutePath =
  | "/"
  | "/plan"
  | "/calendar"
  | "/tasks"
  | "/notes"
  | "/habits"
  | "/focus"
  | "/rewards"
  | "/insights"
  | "/settings";

export type Density = "comfortable" | "compact";

/** Remembered arrangement of the dashboard: which visible cards and their order, plus density. */
export interface DashboardLayout {
  cardOrder: DashboardCard[];
  density: Density;
}

/** A saved workspace configuration: a snapshot of UI preferences, never productivity data.
 * Switching workspaces applies layout/visibility/density without touching tasks, habits or logs. */
export interface WorkspaceConfig {
  id: string;
  name: string;
  /** Snapshot of the dashboard layout at save time (card order + density). */
  dashboardLayout?: DashboardLayout | undefined;
  /** Snapshot of visible dashboard cards at save time. */
  visibleCards?: Record<DashboardCard, boolean> | undefined;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** Per-section remembered preferences (additive optional; defaulted on read). */
export interface SectionPrefs {
  tasks?: {
    view: TaskBucket;
    mode: "list" | "board";
    sort: TaskSort;
  };
}

/** The task-list buckets a view can be built on. */
export type TaskBucket = "today" | "upcoming" | "overdue" | "completed" | "inbox";

/** The filter state of the task list, captured by a saved view. */
export interface TaskViewFilter {
  bucket: TaskBucket;
  priority: Priority | "all";
  tag: string | "all";
  search: string;
  /** Additive optional: saved views also remember sort and display mode. */
  sort?: TaskSort | undefined;
  mode?: "list" | "board" | undefined;
}

/** Task list ordering options (pure sorter in lib/taskSort.ts). */
export type TaskSort = "due" | "priority" | "created";

/** A saved task-list view â€” a named set of filters the user can return to. */
export interface SavedView extends BaseRecord {
  name: string;
  filters: TaskViewFilter;
}

/**
 * A record conflict detected during a sync. Both versions are kept until the
 * user picks one, so nothing is ever lost silently.
 */
export interface SyncConflictEntry {
  id: string;
  collection: string;
  recordId: string;
  reason: "delete-vs-edit" | "same-timestamp";
  local: unknown;
  remote: unknown;
  winner: "local" | "remote";
  at: string;
}

/**
 * Remote-sync configuration. This lives in `settings`, which stays on the
 * device and is never pushed to the remote â€” so the passphrase never leaves
 * the browser.
 */
export interface SyncSettings {
  enabled: boolean;
  /** The remote endpoint URL (Tilth's own route, or a user-supplied endpoint). */
  endpoint: string;
  /** Optional bearer token for the remote. */
  token?: string | undefined;
  /** Passphrase the encryption key is derived from. Device-local. */
  passphrase?: string | undefined;
  /** A stable id for this device, so the remote can label it. */
  deviceId: string;
  /** ISO timestamp of the last successful sync. */
  lastSyncedAt?: string | undefined;
  /** Conflicts waiting for the user to choose a version. */
  conflicts?: SyncConflictEntry[] | undefined;
}

/**
 * Quiet daily digest preferences. Off by default â€” silence is the default;
 * only the user opts in. Additive optional field: no schemaVersion bump.
 */
export interface DigestPrefs {
  enabled: boolean;
  /** Local clock times ("HH:MM") for the morning and evening summaries. */
  morningAt: string;
  eveningAt: string;
}

export interface Settings {
  language: "en" | "ar";
  theme: "light" | "dark" | "system";
  accent: AccentId;
  dayStartHour: 0 | 4;
  weekStartsOn: number; // 0=Sun..6=Sat
  dashboardCards: Record<DashboardCard, boolean>;
  /** Additive optional: remembered dashboard card order + density. Defaults computed on read. */
  dashboardLayout?: DashboardLayout | undefined;
  /** Additive optional: per-section remembered preferences. Defaults computed on read. */
  sectionPrefs?: SectionPrefs | undefined;
  /** Additive optional: saved workspace configurations. Never touches productivity data. */
  workspaces?: WorkspaceConfig[] | undefined;
  /** Additive optional: id of the active workspace whose layout/visibility are applied. */
  activeWorkspaceId?: string | undefined;
  /** Additive optional: route the app opens to on boot. Absent means "/" (Today dashboard). */
  defaultRoute?: RoutePath | undefined;
  /** Additive optional: nav destination keys the user has hidden. Settings is never hideable. */
  navVisibility?: Record<string, boolean> | undefined;
  /** Additive optional: disable motion transitions (e.g. card progress-ring animation). */
  reducedMotion?: boolean | undefined;
  dailyFocusTargetMinutes: number;
  digest?: DigestPrefs | undefined;
  /** Remote-sync configuration. Additive optional field: absent means sync is off. */
  sync?: SyncSettings | undefined;
  updatedAt: ISODate;
}

export interface Meta {
  schemaVersion: number;
  createdAt: ISODate;
  updatedAt: ISODate;
  /** ISO timestamp of the last export; drives the 7-day backup reminder. */
  lastExportedAt?: ISODate | undefined;
}

export interface Collections {
  tasks: Task[];
  notes: Note[];
  habits: Habit[];
  habitLogs: HabitLog[];
  focusSessions: FocusSession[];
  xpLedger: XpLedgerEntry[];
  achievements: AchievementUnlock[];
  shopItems: ShopItem[];
  purchases: Purchase[];
  savedViews: SavedView[];
}
export type CollectionKey = keyof Collections;
export const COLLECTION_KEYS: CollectionKey[] = [
  "tasks",
  "notes",
  "habits",
  "habitLogs",
  "focusSessions",
  "xpLedger",
  "achievements",
  "shopItems",
  "purchases",
  "savedViews",
];

/** Full snapshot = every storage key. Used for load, export, import and migrations. */
export interface Snapshot extends Collections {
  settings: Settings;
  meta: Meta;
}
export type StorageKey = keyof Snapshot;
export const STORAGE_KEYS: StorageKey[] = [...COLLECTION_KEYS, "settings", "meta"];
