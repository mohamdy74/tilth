import { describe, expect, it, vi } from "vitest";
import { composeDigest, slotMinutes, type DigestStrings } from "./digestNotify";
import type { DigestState } from "./digest";
import type { DigestPrefs } from "./types";

const strings: DigestStrings = {
  notif: { morningTitle: "Good morning", eveningTitle: "Evening" },
  dig: {
    tasksDue: "{n} due",
    overdue: "{n} overdue",
    habitsDue: "{n} habits",
    quietDay: "Quiet day",
    completedToday: "{n} done",
    focusToday: "{n} min",
    stillOpen: "{n} open",
    tomorrow: "{n} tomorrow",
  },
};

const state = (hour: number, extra: Partial<DigestState> = {}): DigestState => ({
  tasks: [],
  habits: [],
  logs: [],
  sessions: [],
  today: "2026-11-20",
  hour,
  dayStartHour: 0,
  timeZone: "UTC",
  ...extra,
});

const prefs = (over: Partial<DigestPrefs> = {}): DigestPrefs => ({
  enabled: true,
  morningAt: "07:00",
  eveningAt: "19:00",
  ...over,
});

describe("slotMinutes", () => {
  it("parses HH:MM and tolerates junk", () => {
    expect(slotMinutes("07:30")).toBe(450);
    expect(slotMinutes("")).toBe(0);
    expect(slotMinutes("x:y")).toBe(0);
  });
});

describe("composeDigest", () => {
  it("returns null when the digest is off or unset", () => {
    expect(composeDigest(undefined, state(8), strings)).toBeNull();
    expect(composeDigest(prefs({ enabled: false }), state(8), strings)).toBeNull();
  });

  it("stays silent before the configured morning slot", () => {
    vi.setSystemTime(new Date("2026-11-20T05:00:00"));
    expect(composeDigest(prefs(), state(5), strings)).toBeNull();
    vi.useRealTimers();
  });

  it("composes a quiet morning when nothing is due", () => {
    vi.setSystemTime(new Date("2026-11-20T08:00:00"));
    const n = composeDigest(prefs(), state(8), strings);
    expect(n).toEqual({ slot: "morning", title: "Good morning", body: "Quiet day" });
    vi.useRealTimers();
  });

  it("collapses an empty evening to the quiet-day line", () => {
    vi.setSystemTime(new Date("2026-11-20T20:00:00"));
    const n = composeDigest(prefs(), state(20), strings);
    expect(n).toEqual({ slot: "evening", title: "Evening", body: "Quiet day" });
    vi.useRealTimers();
  });
});
