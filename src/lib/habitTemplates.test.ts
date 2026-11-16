import { describe, expect, it } from "vitest";
import { HABIT_TEMPLATES, templateFor, templatesFor } from "./habitTemplates";

const IDS = [
  "water",
  "exercise",
  "read",
  "meditate",
  "walk",
  "sleep",
  "journal",
  "screenless",
] as const;

describe("HABIT_TEMPLATES", () => {
  it("ships exactly the eight habit templates with stable unique ids", () => {
    expect(HABIT_TEMPLATES.length).toBe(8);
    expect(HABIT_TEMPLATES.map((t) => t.id)).toEqual([...IDS]);
    expect(new Set(HABIT_TEMPLATES.map((t) => t.id)).size).toBe(8);
  });

  it("carries hand-written, distinct Arabic and English copy in both locales", () => {
    for (const tpl of HABIT_TEMPLATES) {
      expect(tpl.name.en.trim()).not.toBe("");
      expect(tpl.name.ar.trim()).not.toBe("");
      expect(tpl.hint.en.trim()).not.toBe("");
      expect(tpl.hint.ar.trim()).not.toBe("");
      expect(tpl.name.ar).not.toBe(tpl.name.en);
      expect(tpl.hint.ar).not.toBe(tpl.hint.en);
    }
  });

  it("gives every template a valid, non-empty day schedule", () => {
    for (const tpl of HABIT_TEMPLATES) {
      expect(["daily", "weekly", "custom"]).toContain(tpl.schedule.type);
      expect(tpl.schedule.days.length).toBeGreaterThan(0);
      for (const day of tpl.schedule.days) {
        expect(Number.isInteger(day)).toBe(true);
        expect(day).toBeGreaterThanOrEqual(0);
        expect(day).toBeLessThanOrEqual(6);
      }
    }
  });

  it("keeps exercise and journal on their custom days and the rest daily", () => {
    const byId = (id: string) => HABIT_TEMPLATES.find((t) => t.id === id);
    expect(byId("exercise")?.schedule).toEqual({ type: "custom", days: [0, 2, 4] });
    expect(byId("journal")?.schedule).toEqual({ type: "custom", days: [1, 2, 3, 4, 5] });
    for (const id of IDS.filter((i) => i !== "exercise" && i !== "journal")) {
      expect(byId(id)?.schedule).toEqual({ type: "daily", days: [0, 1, 2, 3, 4, 5, 6] });
    }
  });
});

describe("templateFor", () => {
  it("returns the template for the asked id in the asked locale", () => {
    expect(templateFor("water", "ar")?.name.ar).toBe("شرب الماء");
    expect(templateFor("water", "en")?.name.en).toBe("Drink Water");
    expect(templateFor("meditate", "ar")?.hint.ar).toBe("عشر دقائق هادئة بلا هاتف");
    expect(templateFor("exercise", "en")?.schedule).toEqual({ type: "custom", days: [0, 2, 4] });
  });

  it("returns null for unknown ids", () => {
    expect(templateFor("nope", "ar")).toBeNull();
    expect(templateFor("nope", "en")).toBeNull();
  });
});

describe("templatesFor", () => {
  it("returns every template with the asked locale's copy", () => {
    const ar = templatesFor("ar");
    const en = templatesFor("en");
    expect(ar.length).toBe(8);
    expect(en.length).toBe(8);
    expect(ar.map((t) => t.id)).toEqual([...IDS]);
    for (const tpl of ar) {
      expect(tpl.name.ar.trim()).not.toBe("");
      expect(tpl.hint.ar.trim()).not.toBe("");
    }
    for (const tpl of en) {
      expect(tpl.name.en.trim()).not.toBe("");
      expect(tpl.hint.en.trim()).not.toBe("");
    }
  });

  it("returns a new array and never mutates the source", () => {
    const before = HABIT_TEMPLATES.map((t) => t.id);
    const out = templatesFor("ar");
    expect(out).not.toBe(HABIT_TEMPLATES);
    expect(out.length).toBe(8);
    expect(HABIT_TEMPLATES.map((t) => t.id)).toEqual(before);
  });
});
