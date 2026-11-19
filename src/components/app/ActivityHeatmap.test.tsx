import { describe, expect, it } from "vitest";
import { nextFocusDay } from "./ActivityHeatmap";

// ---------------- T1: pure month grid ----------------

function monthLayout(firstDay: string, weekStartsOn: number): {
  offset: number;
  cols: number;
  width: number;
  dim: number;
} {
  const wd = new Date(firstDay).getUTCDay();
  const offset = (wd - weekStartsOn + 7) % 7;
  const dt = new Date(Date.UTC(Number(firstDay.slice(0, 4)), Number(firstDay.slice(5, 7)), 0));
  const dim = dt.getUTCDate();
  const cols = Math.ceil((offset + dim) / 7);
  const width = cols * 28 + (cols - 1) * 6;
  return { offset, cols, width, dim };
}

describe("T1: pure month grid layout", () => {
  it("weekStartsOn=Saturday: Dec 2026 -> offset 3, cols 5, width 164", () => {
    expect(monthLayout("2026-12-01", 6)).toEqual({ offset: 3, cols: 5, width: 164, dim: 31 });
  });

  it("weekStartsOn=Saturday: Jan 2027 -> offset 6, cols 6, width 198", () => {
    expect(monthLayout("2027-01-01", 6)).toEqual({ offset: 6, cols: 6, width: 198, dim: 31 });
  });

  it("weekStartsOn=Saturday: Feb 2027 -> offset 2, cols 5, width 164", () => {
    expect(monthLayout("2027-02-01", 6)).toEqual({ offset: 2, cols: 5, width: 164, dim: 28 });
  });

  it("weekStartsOn=Saturday: Feb 2028 (29 days) -> offset 3, cols 5, width 164, 29 cells", () => {
    const r = monthLayout("2028-02-01", 6);
    expect(r.offset).toBe(3);
    expect(r.cols).toBe(5);
    expect(r.width).toBe(164);
    expect(r.dim).toBe(29);
  });

  it("weekStartsOn=Monday: Feb 2027 -> offset 0, cols 4, width 130, 28 cells", () => {
    expect(monthLayout("2027-02-01", 1)).toEqual({ offset: 0, cols: 4, width: 130, dim: 28 });
  });

  it("grid height is always 232", () => {
    expect(7 * 28 + 6 * 6).toBe(232);
  });

  it("day 1 row == offset+1; every (row,col) unique", () => {
    const r = monthLayout("2027-02-01", 6);
    const seen = new Set<string>();
    for (let d = 1; d <= r.dim; d++) {
      const row = ((r.offset + d - 1) % 7) + 1;
      const col = Math.floor((r.offset + d - 1) / 7) + 1;
      expect(row).toBeGreaterThanOrEqual(1);
      expect(row).toBeLessThanOrEqual(7);
      expect(col).toBeGreaterThanOrEqual(1);
      expect(col).toBeLessThanOrEqual(r.cols);
      const key = `${row},${col}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(r.dim);
  });
});

// ---------------- T2: month options ----------------

function monthOptionsPure(today: string, counts: Map<string, number>): string[] {
  const current = today.slice(0, 7);
  let earliest = current;
  for (const day of counts.keys()) {
    const m = day.slice(0, 7);
    if (m < earliest) earliest = m;
  }
  const out: string[] = [];
  let cursor = current;
  while (cursor >= earliest) {
    out.push(cursor);
    const parts = cursor.split("-");
    const y = Number(parts[0]!);
    let m = Number(parts[1]!);
    let prevY = y;
    let prevM = m - 1;
    if (prevM < 1) {
      prevM = 12;
      prevY = y - 1;
    }
    cursor = prevY + "-" + String(prevM).padStart(2, "0");
  }
  return out;
}

describe("T2: month options", () => {
  function countsFor(days: string[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const d of days) m.set(d, 1);
    return m;
  }

  it("earliest 2025-12-14, today 2026-11-19 -> 12 keys, 2026-11 down to 2025-12", () => {
    const c = countsFor(["2025-12-14", "2026-01-01"]);
    const opts = monthOptionsPure("2026-11-19", c);
    expect(opts).toEqual([
      "2026-11", "2026-10", "2026-09", "2026-08", "2026-07", "2026-06",
      "2026-05", "2026-04", "2026-03", "2026-02", "2026-01", "2025-12",
    ]);
    expect(opts.length).toBe(12);
  });

  it("earliest 2025-12-14, today 2026-12-01 -> 13 keys, first 2026-12", () => {
    const c = countsFor(["2025-12-14", "2026-11-01"]);
    const opts = monthOptionsPure("2026-12-01", c);
    expect(opts.length).toBe(13);
    expect(opts[0]).toBe("2026-12");
  });

  it("earliest 2026-11-02, today 2026-11-19 -> [2026-11]", () => {
    const c = countsFor(["2026-11-02"]);
    const opts = monthOptionsPure("2026-11-19", c);
    expect(opts).toEqual(["2026-11"]);
  });

  it("no data, today 2026-11-19 -> [2026-11]", () => {
    const opts = monthOptionsPure("2026-11-19", new Map());
    expect(opts).toEqual(["2026-11"]);
  });

  it("earliest 2026-01-31, today 2026-03-01 -> [2026-03, 2026-02, 2026-01]", () => {
    const c = countsFor(["2026-01-31"]);
    const opts = monthOptionsPure("2026-03-01", c);
    expect(opts).toEqual(["2026-03", "2026-02", "2026-01"]);
  });
});

// ---------------- T4: keyboard pure function ----------------

describe("T4: nextFocusDay keyboard navigation", () => {
  const today = "2026-12-15";
  const dim = 31;

  it("month start clamp: ArrowUp from day 1 stays at 1", () => {
    expect(nextFocusDay("2026-12-01", "ArrowUp", today, dim)).toBe("2026-12-01");
  });

  it("month end clamp: ArrowDown from last day stays at today", () => {
    expect(nextFocusDay("2026-12-31", "ArrowDown", today, dim)).toBe("2026-12-15");
  });

  it("last non-future day clamp: ArrowDown from future day", () => {
    expect(nextFocusDay("2026-12-20", "ArrowDown", today, dim)).toBe("2026-12-15");
  });

  it("+/-7 and +/-1 moves within month", () => {
    expect(nextFocusDay("2026-12-10", "ArrowDown", today, dim)).toBe("2026-12-11");
    expect(nextFocusDay("2026-12-10", "ArrowUp", today, dim)).toBe("2026-12-09");
    expect(nextFocusDay("2026-12-10", "ArrowRight", today, dim)).toBe("2026-12-17");
    expect(nextFocusDay("2026-12-10", "ArrowLeft", today, dim)).toBe("2026-12-03");
  });

  it("Home goes to day 1", () => {
    expect(nextFocusDay("2026-12-20", "Home", today, dim)).toBe("2026-12-01");
  });

  it("End goes to last non-future day", () => {
    expect(nextFocusDay("2026-12-05", "End", today, dim)).toBe("2026-12-15");
  });

  it("+/-7 clamped at month boundaries", () => {
    expect(nextFocusDay("2026-12-01", "ArrowLeft", today, dim)).toBe("2026-12-01");
    expect(nextFocusDay("2026-12-31", "ArrowRight", today, dim)).toBe("2026-12-15");
  });

  it("unknown key returns null", () => {
    expect(nextFocusDay("2026-12-10", "PageDown" as any, today, dim)).toBe(null);
  });
});
