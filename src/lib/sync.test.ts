import { describe, expect, it } from "vitest";
import { fromSyncPayload, isSyncPayload, mergeSync, stableStringify, toSyncPayload } from "./sync";

describe("sync merge", () => {
  it("keeps a record that exists on only one side", () => {
    const { merged } = mergeSync(
      { tasks: [{ id: "a", updatedAt: "t1", name: "A" }] },
      { notes: [{ id: "b", updatedAt: "t1", name: "B" }] },
      "now",
    );
    expect(merged["tasks"]).toEqual([{ id: "a", updatedAt: "t1", name: "A" }]);
    expect(merged["notes"]).toEqual([{ id: "b", updatedAt: "t1", name: "B" }]);
  });

  it("newer updatedAt wins", () => {
    const { merged } = mergeSync(
      { tasks: [{ id: "a", updatedAt: "t1", name: "old" }] },
      { tasks: [{ id: "a", updatedAt: "t2", name: "new" }] },
      "now",
    );
    expect(merged["tasks"]).toEqual([{ id: "a", updatedAt: "t2", name: "new" }]);
    const tasks = merged["tasks"]!;
    expect(tasks[0]!["name"]).toBe("new");
  });

  it("same timestamp + identical content -> one copy, no conflict", () => {
    const r = { id: "a", updatedAt: "t1", name: "A" };
    const { merged, conflicts } = mergeSync({ tasks: [r] }, { tasks: [{ ...r }] }, "now");
    expect(merged["tasks"]).toEqual([r]);
    expect(conflicts).toEqual([]);
  });

  it("same timestamp + different content -> deterministic tie-break, conflict recorded", () => {
    const { merged, conflicts } = mergeSync(
      { tasks: [{ id: "a", updatedAt: "t1", name: "aaa" }] },
      { tasks: [{ id: "a", updatedAt: "t1", name: "bbb" }] },
      "now",
    );
    expect(merged["tasks"]).toEqual([{ id: "a", updatedAt: "t1", name: "aaa" }]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.id).toBe("tasks:a");
    expect(conflicts[0]!.reason).toBe("same-timestamp");
    expect(conflicts[0]!.winner).toBe("local");
    // Same result regardless of argument order: "aaa" wins both times.
    const swapped = mergeSync(
      { tasks: [{ id: "a", updatedAt: "t1", name: "bbb" }] },
      { tasks: [{ id: "a", updatedAt: "t1", name: "aaa" }] },
      "now",
    );
    expect(swapped.merged["tasks"]).toEqual(merged["tasks"]);
    expect(swapped.conflicts[0]!.winner).toBe("remote"); // "aaa" is now remote
  });

  it("delete-vs-edit -> delete wins, conflict recorded, nothing lost", () => {
    const local = { id: "a", updatedAt: "t2", name: "edited", deletedAt: undefined };
    const remote = { id: "a", updatedAt: "t1", name: "orig", deletedAt: "t1" };
    const { merged, conflicts } = mergeSync({ tasks: [local] }, { tasks: [remote] }, "now");
    expect(merged["tasks"]).toEqual([remote]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.reason).toBe("delete-vs-edit");
    expect(conflicts[0]!.winner).toBe("remote");
    // Both versions survive on the conflict so the user can pick.
    expect(conflicts[0]!.local).toBe(local);
    expect(conflicts[0]!.remote).toBe(remote);
  });
});

describe("sync payload", () => {
  const good: Record<string, unknown> = {
    v: 1,
    schemaVersion: 5,
    deviceId: "dev-1",
    updatedAt: "2026-01-01T00:00:00Z",
    collections: { tasks: [{ id: "a", updatedAt: "t1" }] },
  };

  it("round trips", () => {
    const p = toSyncPayload({
      collections: { tasks: [{ id: "a", updatedAt: "t1" }] },
      schemaVersion: 5,
      deviceId: "d",
      at: "now",
    });
    expect(fromSyncPayload(p)).toEqual({
      v: 1,
      schemaVersion: 5,
      deviceId: "d",
      updatedAt: "now",
      collections: { tasks: [{ id: "a", updatedAt: "t1" }] },
    });
  });

  it("rejects bad payloads", () => {
    expect(fromSyncPayload(null)).toBeNull();
    expect(fromSyncPayload("x")).toBeNull();
    expect(fromSyncPayload({ ...good, v: 2 })).toBeNull();
    expect(fromSyncPayload({ ...good, schemaVersion: "5" })).toBeNull();
    expect(fromSyncPayload({ ...good, collections: { tasks: [{ id: 1 }] } })).toBeNull();
    expect(fromSyncPayload({ ...good, collections: "nope" })).toBeNull();
  });

  it("isSyncPayload", () => {
    expect(isSyncPayload(good)).toBe(true);
    expect(isSyncPayload({})).toBe(false);
  });
});

describe("stableStringify", () => {
  it("is key-order independent", () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }));
    expect(stableStringify([{ z: 1 }])).toBe(stableStringify([{ z: 1 }]));
  });
});
