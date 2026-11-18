import { describe, expect, it } from "vitest";
import { CARD_W, shareCardLayout } from "./shareCard";
import type { ShareCellKind } from "./shareCard";

const weeks: ShareCellKind[][] = Array.from({ length: 12 }, () =>
  Array.from({ length: 7 }, () => "done" as ShareCellKind),
);

describe("shareCardLayout", () => {
  it("lays out 12x7 cells inside the card", () => {
    const cells = shareCardLayout(weeks, false);
    expect(cells).toHaveLength(84);
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + c.size).toBeLessThanOrEqual(CARD_W);
    }
  });

  it("mirrors column order in RTL without changing rows", () => {
    const ltr = shareCardLayout(weeks, false);
    const rtl = shareCardLayout(weeks, true);
    expect(rtl[0]!.x).toBeGreaterThan(ltr[0]!.x);
    expect(rtl[0]!.y).toBe(ltr[0]!.y);
    expect(rtl[6]!.y).toBeGreaterThan(rtl[0]!.y);
  });

  it("cells never overlap", () => {
    const cells = shareCardLayout(weeks, true);
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i]!;
        const b = cells[j]!;
        const apart =
          a.x + a.size <= b.x || b.x + b.size <= a.x || a.y + a.size <= b.y || b.y + b.size <= a.y;
        expect(apart).toBe(true);
      }
    }
  });
});
