import { describe, expect, it } from "vitest";
import { checkForUpdate, shouldRegisterPwa } from "./pwa";

describe("pwa update path", () => {
  it("never registers in dev/preview (vitest runs as DEV)", () => {
    expect(shouldRegisterPwa()).toBe(false);
  });

  it("checkForUpdate degrades to unsupported without a service worker", async () => {
    // jsdom exposes no navigator.serviceWorker registration.
    await expect(checkForUpdate()).resolves.toBe("unsupported");
  });
});
