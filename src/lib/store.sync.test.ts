import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptPayload } from "./syncCrypto";
import { toSyncPayload } from "./sync";
import { defaultSettings, flushAll, settings as settingsApi, sync, tasks, useStore } from "./store";
import { COLLECTION_KEYS, CURRENT_SCHEMA_VERSION } from "./types";

const PASSPHRASE = "sync race test passphrase";

function resetStore() {
  useStore.setState({
    ...Object.fromEntries(COLLECTION_KEYS.map((key) => [key, []])),
    settings: {
      ...defaultSettings("en"),
      sync: {
        enabled: true,
        endpoint: "",
        passphrase: PASSPHRASE,
        deviceId: "local-device",
      },
    },
    meta: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    ready: true,
    error: null,
    revs: {},
    pending: [],
  });
}

describe("remote sync concurrency", () => {
  afterEach(async () => {
    await flushAll();
    vi.unstubAllGlobals();
    resetStore();
    await flushAll();
  });

  it("keeps records created while a pull is in flight", async () => {
    resetStore();
    const remote = await encryptPayload(
      PASSPHRASE,
      JSON.stringify(
        toSyncPayload({
          collections: { tasks: [] },
          schemaVersion: CURRENT_SCHEMA_VERSION,
          deviceId: "remote-device",
          at: "2026-01-01T00:00:00.000Z",
        }),
      ),
    );
    let answer: ((response: Response) => void) | undefined;
    const response = new Promise<Response>((resolve) => {
      answer = resolve;
    });
    const fetchMock = vi.fn(() => response);
    vi.stubGlobal("fetch", fetchMock);

    const pulling = sync.pull();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    tasks.add({ title: "created during pull" });
    settingsApi.update({ dailyFocusTargetMinutes: 42 });
    answer!(new Response(JSON.stringify(remote), { status: 200 }));

    const result = await pulling;
    expect(result.ok).toBe(true);
    expect(useStore.getState().tasks.map((task) => task.title)).toContain("created during pull");
    expect(useStore.getState().settings.dailyFocusTargetMinutes).toBe(42);
  }, 30_000);

  it("does not restore stale settings after a push finishes", async () => {
    resetStore();
    let answer: ((response: Response) => void) | undefined;
    const response = new Promise<Response>((resolve) => {
      answer = resolve;
    });
    const fetchMock = vi.fn(() => response);
    vi.stubGlobal("fetch", fetchMock);

    const pushing = sync.push();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    settingsApi.update({ dailyFocusTargetMinutes: 42 });
    answer!(new Response(null, { status: 204 }));

    const result = await pushing;
    expect(result.ok).toBe(true);
    expect(useStore.getState().settings.dailyFocusTargetMinutes).toBe(42);
  }, 30_000);
});
