import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { defaultDashboardLayout, defaultSettings, flushAll, settings as settingsApi, useStore, workspaces } from "./store";
import { COLLECTION_KEYS, CURRENT_SCHEMA_VERSION } from "./types";

function resetStore() {
  useStore.setState({
    ...Object.fromEntries(COLLECTION_KEYS.map((key) => [key, []])),
    settings: defaultSettings("en"),
    meta: { schemaVersion: CURRENT_SCHEMA_VERSION, createdAt: "t", updatedAt: "t" },
    ready: true,
    error: null,
    revs: {},
    pending: [],
  });
}

describe("workspaces (saved UI configurations)", () => {
  afterEach(async () => {
    await flushAll();
    resetStore();
    await flushAll();
  });

  it("captures the current layout as a named workspace and makes it active", () => {
    resetStore();
    settingsApi.update({
      dashboardLayout: { cardOrder: ["habits", "priorities"], density: "compact" },
    });
    const ws = workspaces.add("Daily focus");
    expect(ws).toBeDefined();
    expect(ws!.name).toBe("Daily focus");
    expect(ws!.dashboardLayout?.density).toBe("compact");
    expect(ws!.dashboardLayout?.cardOrder).toEqual(["habits", "priorities"]);
    expect(useStore.getState().settings.activeWorkspaceId).toBe(ws!.id);
    const saved = useStore.getState().settings.workspaces;
    expect(saved).toHaveLength(1);
    expect(saved![0].visibleCards).toEqual(expect.objectContaining({ priorities: true }));
  });

  it("switching a workspace applies layout/visibility without touching data", () => {
    resetStore();
    settingsApi.update({
      dashboardLayout: { cardOrder: ["habits", "priorities"], density: "compact" },
    });
    const ws = workspaces.add("A");
    // change settings away from the captured layout
    settingsApi.update({
      dashboardLayout: defaultDashboardLayout(),
      dashboardCards: { priorities: false },
    });
    workspaces.switchTo(ws.id);
    const s = useStore.getState().settings;
    expect(s.activeWorkspaceId).toBe(ws.id);
    expect(s.dashboardLayout?.density).toBe("compact");
    expect(s.dashboardLayout?.cardOrder).toEqual(["habits", "priorities"]);
    expect(s.dashboardCards.priorities).toBe(true);
  });

  it("switchTo ignores unknown ids", () => {
    resetStore();
    workspaces.switchTo("does-not-exist");
    expect(useStore.getState().settings.activeWorkspaceId).toBeUndefined();
  });

  it("reset clears workspaces and restores the factory layout", () => {
    resetStore();
    workspaces.add("A");
    workspaces.reset();
    const s = useStore.getState().settings;
    expect(s.workspaces).toBeUndefined();
    expect(s.activeWorkspaceId).toBeUndefined();
    expect(s.dashboardLayout).toEqual(defaultDashboardLayout());
    expect(s.dashboardCards.priorities).toBe(true);
  });
});
