import { isValidTimestamp } from "./dates";
import { runMigrations, type AnySnapshot } from "./migrations";
import {
  COLLECTION_KEYS,
  CURRENT_SCHEMA_VERSION,
  type CollectionKey,
  type Snapshot,
} from "./types";

/** Export envelope written to disk. `data` is a full store snapshot. */
export interface BackupFile {
  schemaVersion: number;
  exportedAt: string;
  data: Snapshot;
}

export type BackupErrorCode = "invalid-json" | "invalid-shape" | "newer-schema" | "empty";

export class BackupError extends Error {
  code: BackupErrorCode;
  constructor(code: BackupErrorCode) {
    super(code);
    this.name = "BackupError";
    this.code = code;
  }
}

export interface ParsedBackup {
  /** Schema version the file was written with (before any migration). */
  schemaVersion: number;
  exportedAt: string | null;
  /** Set when the file was older than the app and had to be migrated. */
  migratedFrom: number | null;
  snapshot: Snapshot;
  counts: Record<CollectionKey, number>;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): v is string => typeof v === "string";
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const bool = (v: unknown): v is boolean => typeof v === "boolean";
const opt = (v: unknown, check: (value: unknown) => boolean) => v === undefined || check(v);
const oneOf = (v: unknown, values: readonly string[]) => str(v) && values.includes(v);
const strings = (v: unknown) => Array.isArray(v) && v.every(str);
const iso = (v: unknown) => str(v) && isValidTimestamp(v);
const day = (v: unknown) => {
  if (!str(v) || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const parsed = new Date(v + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
};
const days = (v: unknown) =>
  Array.isArray(v) && v.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
const rec = (v: unknown): v is Record<string, unknown> =>
  isObj(v) &&
  str(v["id"]) &&
  v["id"].length > 0 &&
  iso(v["createdAt"]) &&
  iso(v["updatedAt"]) &&
  opt(v["deletedAt"], iso);
const recurrence = (v: unknown) =>
  isObj(v) &&
  oneOf(v["freq"], ["daily", "weekly", "monthly"]) &&
  num(v["interval"]) &&
  v["interval"] >= 1 &&
  opt(v["byWeekday"], days);
const schedule = (v: unknown) =>
  isObj(v) && oneOf(v["type"], ["daily", "weekly", "custom"]) && days(v["days"]);

/** Runtime counterparts of the persisted types. Optional additive fields stay optional. */
const RECORD_VALIDATORS: Record<CollectionKey, (value: unknown) => boolean> = {
  tasks: (v) =>
    rec(v) &&
    str(v["title"]) &&
    oneOf(v["priority"], ["low", "medium", "high"]) &&
    oneOf(v["status"], ["todo", "doing", "done"]) &&
    strings(v["tags"]) &&
    Array.isArray(v["subtasks"]) &&
    v["subtasks"].every((s) => isObj(s) && str(s["id"]) && str(s["title"]) && bool(s["done"])) &&
    num(v["kanbanOrder"]) &&
    opt(v["notes"], str) &&
    opt(v["dueDate"], day) &&
    opt(v["completedAt"], iso) &&
    opt(v["recurrence"], recurrence) &&
    opt(v["seriesId"], str) &&
    opt(v["blockStart"], num),
  notes: (v) =>
    rec(v) &&
    str(v["title"]) &&
    str(v["body"]) &&
    opt(v["linkedTaskId"], str) &&
    opt(v["pinned"], bool),
  habits: (v) =>
    rec(v) &&
    str(v["name"]) &&
    schedule(v["schedule"]) &&
    bool(v["archived"]) &&
    opt(v["pausedFrom"], day) &&
    opt(v["pausedUntil"], day),
  habitLogs: (v) =>
    rec(v) && str(v["habitId"]) && day(v["localDay"]) && oneOf(v["status"], ["done", "skipped"]),
  focusSessions: (v) =>
    rec(v) &&
    oneOf(v["mode"], ["pomodoro", "custom", "break"]) &&
    num(v["plannedMinutes"]) &&
    v["plannedMinutes"] > 0 &&
    iso(v["startedAt"]) &&
    iso(v["endsAt"]) &&
    opt(v["endedAt"], iso) &&
    opt(v["pausedAt"], iso) &&
    bool(v["completed"]) &&
    Array.isArray(v["distractions"]) &&
    v["distractions"].every((d) => isObj(d) && iso(d["at"])) &&
    opt(v["linkedTaskId"], str) &&
    day(v["localDay"]),
  xpLedger: (v) =>
    rec(v) &&
    oneOf(v["sourceType"], ["task", "habit", "focus", "challenge", "achievement", "shop"]) &&
    str(v["sourceId"]) &&
    day(v["localDay"]) &&
    num(v["xp"]) &&
    num(v["coins"]),
  achievements: (v) =>
    rec(v) && str(v["achievementId"]) && iso(v["unlockedAt"]) && day(v["localDay"]),
  shopItems: (v) =>
    rec(v) &&
    str(v["name"]) &&
    Number.isInteger(v["price"]) &&
    (v["price"] as number) > 0 &&
    opt(v["note"], str) &&
    opt(v["category"], str),
  purchases: (v) =>
    rec(v) &&
    str(v["itemId"]) &&
    str(v["name"]) &&
    Number.isInteger(v["price"]) &&
    (v["price"] as number) > 0 &&
    day(v["localDay"]) &&
    opt(v["usedAt"], iso),
  savedViews: (v) =>
    rec(v) &&
    str(v["name"]) &&
    isObj(v["filters"]) &&
    oneOf(v["filters"]["bucket"], ["today", "upcoming", "overdue", "completed", "inbox"]) &&
    oneOf(v["filters"]["priority"], ["low", "medium", "high", "all"]) &&
    str(v["filters"]["tag"]) &&
    str(v["filters"]["search"]) &&
    opt(v["filters"]["sort"], (s) => oneOf(s, ["due", "priority", "created"])) &&
    opt(v["filters"]["mode"], (m) => oneOf(m, ["list", "board"])),
};

function validSettings(v: unknown): boolean {
  if (!isObj(v)) return false;
  return (
    opt(v["language"], (x) => oneOf(x, ["en", "ar"])) &&
    opt(v["theme"], (x) => oneOf(x, ["light", "dark", "system"])) &&
    opt(v["accent"], str) &&
    opt(v["dayStartHour"], (x) => x === 0 || x === 4) &&
    opt(
      v["weekStartsOn"],
      (x) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 6,
    ) &&
    opt(v["dashboardCards"], (x) => isObj(x) && Object.values(x).every(bool)) &&
    opt(v["dailyFocusTargetMinutes"], (x) => num(x) && (x as number) >= 0) &&
    opt(v["digest"], (x) =>
      isObj(x) ? bool(x["enabled"]) && str(x["morningAt"]) && str(x["eveningAt"]) : false,
    ) &&
    opt(v["sync"], (x) =>
      isObj(x)
        ? bool(x["enabled"]) &&
          str(x["endpoint"]) &&
          str(x["deviceId"]) &&
          opt(x["token"], str) &&
          opt(x["passphrase"], str) &&
          opt(x["lastSyncedAt"], iso)
        : false,
    ) &&
    opt(v["updatedAt"], iso)
  );
}

function validMeta(v: unknown): boolean {
  return (
    isObj(v) &&
    num(v["schemaVersion"]) &&
    Number.isInteger(v["schemaVersion"]) &&
    opt(v["createdAt"], iso) &&
    opt(v["updatedAt"], iso) &&
    opt(v["lastExportedAt"], iso)
  );
}

/** Builds the export envelope. Pure. */
export function buildBackup(
  snap: Snapshot,
  exportedAt: string = new Date().toISOString(),
): BackupFile {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt, data: snap };
}

/** tilth-export-YYYY-MM-DD.json — LOCAL date, so the name matches the user's day. */
export function backupFileName(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    "tilth-export-" +
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    ".json"
  );
}

/**
 * Validates and normalizes a backup file. PURE: never touches the store.
 * Newer files are rejected (update the app first); older files are migrated
 * here so importSnapshot() stays a dumb writer. A rejected file never
 * modifies existing data.
 */
export function parseBackup(text: string): ParsedBackup {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    throw new BackupError("invalid-json");
  }
  if (!isObj(root)) throw new BackupError("invalid-shape");

  const v = root["schemaVersion"];
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0)
    throw new BackupError("invalid-shape");
  const data = root["data"];
  if (!isObj(data)) throw new BackupError("invalid-shape");
  const exportedAt = root["exportedAt"];
  if (exportedAt !== undefined && typeof exportedAt !== "string")
    throw new BackupError("invalid-shape");
  if (v > CURRENT_SCHEMA_VERSION) throw new BackupError("newer-schema");

  // The file-level schemaVersion wins; meta may be missing (v0) or stale.
  const normalized: AnySnapshot = {
    ...data,
    meta: { ...(isObj(data["meta"]) ? data["meta"] : {}), schemaVersion: v },
  };
  let out = normalized;
  let migratedFrom: number | null = null;
  if (v < CURRENT_SCHEMA_VERSION) {
    const res = runMigrations(normalized);
    out = res.data;
    migratedFrom = res.from;
  }

  // Post-migration shape checks — an import must never write garbage.
  for (const k of COLLECTION_KEYS) {
    const records = out[k];
    if (!Array.isArray(records) || !records.every(RECORD_VALIDATORS[k])) {
      throw new BackupError("invalid-shape");
    }
  }
  if ("settings" in out && !validSettings(out["settings"])) {
    throw new BackupError("invalid-shape");
  }
  if ("meta" in out && !validMeta(out["meta"])) throw new BackupError("invalid-shape");

  const counts = {} as Record<CollectionKey, number>;
  let total = 0;
  for (const k of COLLECTION_KEYS) {
    const n = (out[k] as unknown[]).length;
    counts[k] = n;
    total += n;
  }
  if (total === 0) throw new BackupError("empty");

  return {
    schemaVersion: v,
    exportedAt: typeof exportedAt === "string" ? exportedAt : null,
    migratedFrom,
    snapshot: out as unknown as Snapshot,
    counts,
  };
}
