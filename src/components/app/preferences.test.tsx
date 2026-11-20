import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreferencesProvider, usePrefs } from "./preferences";

let renderedLocale = "";
function Probe() {
  renderedLocale = usePrefs().locale;
  return null;
}

describe("PreferencesProvider persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    renderedLocale = "";
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("does not overwrite saved preferences with defaults while they load", async () => {
    localStorage.setItem(
      "tilth.prefs",
      JSON.stringify({ locale: "en", theme: "dark", accent: "moss" }),
    );
    const writes: string[] = [];
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      if (key === "tilth.prefs") writes.push(value);
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PreferencesProvider>
          <Probe />
        </PreferencesProvider>,
      );
    });
    await act(async () => root.unmount());

    expect(renderedLocale).toBe("en");
    expect(writes).not.toContain(JSON.stringify({ locale: "ar", theme: "dark", accent: "moss" }));
  });
});
