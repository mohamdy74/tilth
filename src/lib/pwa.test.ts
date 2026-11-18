import { describe, expect, it } from "vitest";
import { buildStamp, checkForUpdate, refreshAppFiles, shouldRegisterPwa } from "./pwa";

describe("pwa update path", () => {
  it("never registers in dev/preview (vitest runs as DEV)", () => {
    expect(shouldRegisterPwa()).toBe(false);
  });

  it("checkForUpdate degrades to unsupported without a service worker", async () => {
    // jsdom exposes no navigator.serviceWorker registration.
    await expect(checkForUpdate()).resolves.toBe("unsupported");
  });
});

describe("stuck-cache escape hatch", () => {
  it("refreshAppFiles degrades to false without service worker/cache APIs", async () => {
    await expect(refreshAppFiles()).resolves.toBe(false);
  });

  it("buildStamp falls back to dev outside a define-injected build", () => {
    expect(buildStamp()).toBe("dev");
  });
});
