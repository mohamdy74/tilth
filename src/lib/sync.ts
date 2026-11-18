import type { Snapshot } from "./types";

/*
 * Pure remote-sync engine. No fetch, no storage, no clock â€” `at` is always
 * passed in so tests are deterministic. Local stays the source of truth: the
 * remote is a replica, and merge never lets the remote silently overwrite
 * newer local data. `settings` and `meta` stay device-local on purpose (the
 * passphrase lives in settings and must never leave the device).
 */

export type SyncRecord = { id: string; updatedAt: string; deletedAt?: string | undefined } & Record<
  string,
  unknown
>;

export interface SyncConflict {
  id: string; // `${collection}:${recordId}`
  collection: string;
  recordId: string;
  reason: "delete-vs-edit" | "same-timestamp";
  local: unknown;
  remote: unknown;
  winner: "local" | "remote";
  at: string;
}

export interface MergeResult {
  merged: Record<string, SyncRecord[]>;
  conflicts: SyncConflict[];
}

export const SYNC_COLLECTIONS = [
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
] as const;

/** JSON.stringify with recursively sorted keys â€” comparison is key-order independent. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  if (v !== null && typeof v === "object") {
    const keys = Object.keys(v as Record<string, unknown>).sort();
    return (
      "{" +
      keys
        .map((k) => JSON.stringify(k) + ":" + stableStringify((v as Record<string, unknown>)[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(v);
}

function isRecord(v: unknown): v is SyncRecord {
  return (
    v !== null &&
    typeof v === "object" &&
    typeof (v as { id?: unknown }).id === "string" &&
    typeof (v as { updatedAt?: unknown }).updatedAt === "string"
  );
}

/**
 * Per-record merge, tombstone-aware:
 * - one side only -> keep it
 * - equal updatedAt, identical content -> one copy, no conflict
 * - equal updatedAt, different content -> deterministic tie-break (lexicographically
 *   smaller canonical JSON wins), conflict recorded
 * - different updatedAt -> newer wins
 * - delete-vs-edit -> the tombstone is sticky and always wins, conflict recorded
 * No record that existed on either side is ever dropped.
 */
export function mergeSync(
  local: Record<string, SyncRecord[]>,
  remote: Record<string, SyncRecord[]>,
  at: string,
): MergeResult {
  const collections = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const merged: Record<string, SyncRecord[]> = {};
  const conflicts: SyncConflict[] = [];
  for (const c of collections) {
    const lmap = new Map((local[c] ?? []).map((r) => [r.id, r]));
    const rmap = new Map((remote[c] ?? []).map((r) => [r.id, r]));
    const out: SyncRecord[] = [];
    for (const id of new Set([...lmap.keys(), ...rmap.keys()])) {
      const l = lmap.get(id);
      const r = rmap.get(id);
      if (!l || !r) {
        out.push((l ?? r)!);
        continue;
      }
      const lDeleted = l.deletedAt !== undefined;
      const rDeleted = r.deletedAt !== undefined;
      if (lDeleted !== rDeleted) {
        // tombstone is sticky
        const winner = lDeleted ? l : r;
        out.push(winner);
        conflicts.push({
          id: `${c}:${id}`,
          collection: c,
          recordId: id,
          reason: "delete-vs-edit",
          local: l,
          remote: r,
          winner: lDeleted ? "local" : "remote",
          at,
        });
        continue;
      }
      if (l.updatedAt !== r.updatedAt) {
        out.push(l.updatedAt > r.updatedAt ? l : r);
        continue;
      }

      // Canonical JSON is only needed for identical-content and tie-break checks.
      const ls = stableStringify(l);
      const rs = stableStringify(r);
      if (ls === rs) {
        out.push(l);
        continue;
      }
      const winner = ls < rs ? l : r;
      out.push(winner);
      conflicts.push({
        id: `${c}:${id}`,
        collection: c,
        recordId: id,
        reason: "same-timestamp",
        local: l,
        remote: r,
        winner: ls < rs ? "local" : "remote",
        at,
      });
    }
    merged[c] = out;
  }
  return { merged, conflicts };
}

export interface SyncPayload {
  v: 1;
  schemaVersion: number;
  deviceId: string;
  updatedAt: string;
  collections: Record<string, SyncRecord[]>;
}

export function toSyncPayload(input: {
  collections: Record<string, SyncRecord[]>;
  schemaVersion: number;
  deviceId: string;
  at: string;
}): SyncPayload {
  return {
    v: 1,
    schemaVersion: input.schemaVersion,
    deviceId: input.deviceId,
    updatedAt: input.at,
    collections: input.collections,
  };
}

/** Strict validation â€” returns null on anything malformed, never throws. */
export function fromSyncPayload(payload: unknown): SyncPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as SyncPayload;
  if (p.v !== 1) return null;
  if (
    typeof p.schemaVersion !== "number" ||
    typeof p.deviceId !== "string" ||
    typeof p.updatedAt !== "string"
  )
    return null;
  const coll = p.collections;
  if (!coll || typeof coll !== "object" || Array.isArray(coll)) return null;
  const collections: Record<string, SyncRecord[]> = {};
  for (const [k, v] of Object.entries(coll)) {
    if (!Array.isArray(v) || !v.every(isRecord)) return null;
    collections[k] = v as SyncRecord[];
  }
  return {
    v: 1,
    schemaVersion: p.schemaVersion,
    deviceId: p.deviceId,
    updatedAt: p.updatedAt,
    collections,
  };
}

export function isSyncPayload(v: unknown): v is SyncPayload {
  return fromSyncPayload(v) !== null;
}

/** Picks the synced collections out of a full snapshot. */
export function syncedCollectionsOf(snap: Snapshot): Record<string, SyncRecord[]> {
  const out: Record<string, SyncRecord[]> = {};
  for (const c of SYNC_COLLECTIONS) out[c] = snap[c] as unknown as SyncRecord[];
  return out;
}
