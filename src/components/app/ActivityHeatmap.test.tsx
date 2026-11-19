import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { PreferencesProvider } from "./preferences";

const empty = {
  tasks: [],
  habits: [],
  habitLogs: [],
  focusSessions: [],
};

function render(today: string, weekStartsOn: number): Document {
  const html = renderToStaticMarkup(
    <PreferencesProvider>
      <ActivityHeatmap
        {...empty}
        today={today}
        weekStartsOn={weekStartsOn}
        dayStartHour={0}
        timeZone="UTC"
      />
    </PreferencesProvider>,
  );
  return new DOMParser().parseFromString(html, "text/html");
}

/** Blocks are rendered oldest-first; the last block is today's month. */
function lastBlock(doc: Document): HTMLElement {
  const blocks = Array.from(doc.querySelectorAll<HTMLElement>("[data-hm-block]"));
  return blocks[blocks.length - 1]!;
}

describe("ActivityHeatmap pixel layout (SSR)", () => {
  it("root dir is ltr", () => {
    const doc = render("2026-12-15", 6);
    const root = doc.querySelector('[data-hm-root]');
    expect(root).not.toBeNull();
    expect(root!.getAttribute("dir")).toBe("ltr");
  });

  it("every cell is 12px x 12px via literal class", () => {
    const doc = render("2026-12-15", 6);
    const cells = doc.querySelectorAll('[data-hm-cell]');
    expect(cells.length).toBeGreaterThan(0);
    for (const el of cells) {
      const cls = el.getAttribute("class") ?? "";
      expect(cls).toContain("w-[12px]");
      expect(cls).toContain("h-[12px]");
    }
  });

  it("every block uses gridTemplateColumns repeat(cols,12px), rows repeat(7,12px), gap 3px", () => {
    const doc = render("2026-12-15", 6);
    const blocks = doc.querySelectorAll('[data-hm-block]');
    expect(blocks.length).toBe(12);
    for (const elNode of blocks) {
      const el = elNode as HTMLElement;
      const cols = Number(el.getAttribute("data-cols"));
      expect(cols).toBeGreaterThan(0);
      expect(el.style.gridTemplateColumns).toBe(`repeat(${cols}, 12px)`);
      expect(el.style.gridTemplateRows).toBe("repeat(7, 12px)");
      expect(el.style.gap).toBe("3px");
      const expectedWidth = cols * 12 + (cols - 1) * 3;
      expect(el.style.width).toBe(`${expectedWidth}px`);
      expect(el.style.height).toBe("102px");
    }
  });

  it("Saturday start: Dec 2026 -> 72, Jan 2027 -> 87, Feb 2027 -> 72", () => {
    const dec = lastBlock(render("2026-12-15", 6));
    expect(Number(dec.getAttribute("data-cols"))).toBe(5);
    expect(dec.style.width).toBe("72px");

    const jan = lastBlock(render("2027-01-15", 6));
    expect(Number(jan.getAttribute("data-cols"))).toBe(6);
    expect(jan.style.width).toBe("87px");

    const feb = lastBlock(render("2027-02-15", 6));
    expect(Number(feb.getAttribute("data-cols"))).toBe(5);
    expect(feb.style.width).toBe("72px");
  });

  it("Monday start: Feb 2027 -> 57", () => {
    const feb = lastBlock(render("2027-02-15", 1));
    expect(Number(feb.getAttribute("data-cols"))).toBe(4);
    expect(feb.style.width).toBe("57px");
  });
});
