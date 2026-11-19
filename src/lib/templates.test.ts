import { describe, expect, it } from "vitest";
import {
  HABIT_TEMPLATES,
  NOTE_TEMPLATES,
  TASK_TEMPLATES,
  habitTemplateFor,
  templateFor,
  taskTemplateFor,
  type TemplateId,
} from "./templates";

describe("NOTE_TEMPLATES", () => {
  it("ships exactly the four Arabic-first templates", () => {
    expect(NOTE_TEMPLATES.map((x) => x.id)).toEqual([
      "study",
      "freelance",
      "content",
      "ramadan",
    ] as TemplateId[]);
  });

  it("carries hand-written, distinct Arabic and English copy with checkboxes", () => {
    expect(NOTE_TEMPLATES.length).toBe(4);
    for (const tpl of NOTE_TEMPLATES) {
      expect(tpl.title.ar.trim()).not.toBe("");
      expect(tpl.title.en.trim()).not.toBe("");
      expect(tpl.title.ar).not.toBe(tpl.title.en);
      expect(tpl.body.ar).toContain("- [ ]");
      expect(tpl.body.en).toContain("- [ ]");
      expect(tpl.body.ar).not.toBe(tpl.body.en);
    }
  });
});

describe("templateFor", () => {
  it("returns the hand-written copy for the asked locale", () => {
    expect(templateFor("study", "ar")?.title).toBe("مذاكرة");
    expect(templateFor("study", "en")?.title).toBe("Study session");
    expect(templateFor("freelance", "ar")?.title).toBe("عمل حر");
    expect(templateFor("content", "en")?.title).toBe("Content plan");
    expect(templateFor("ramadan", "ar")?.body).toContain("رمضان");
  });

  it("returns null for unknown ids", () => {
    expect(templateFor("nope", "ar")).toBeNull();
  });
});

describe("HABIT_TEMPLATES", () => {
  it("ships two bounded Arabic-first templates", () => {
    expect(HABIT_TEMPLATES.map((x) => x.id)).toEqual(["morning", "deep"]);
    for (const tpl of HABIT_TEMPLATES) {
      expect(tpl.name.ar.trim()).not.toBe("");
      expect(tpl.name.en.trim()).not.toBe("");
      expect(tpl.name.ar).not.toBe(tpl.name.en);
      expect(tpl.description.ar).not.toBe(tpl.description.en);
      expect(tpl.schedule.days.length).toBeGreaterThan(0);
    }
  });
});

describe("habitTemplateFor", () => {
  it("returns the locale copy", () => {
    expect(habitTemplateFor("morning", "ar")?.name).toBe("روتين الصباح");
    expect(habitTemplateFor("deep", "en")?.name).toBe("Deep work block");
    expect(habitTemplateFor("deep", "ar")?.schedule.type).toBe("custom");
  });
  it("returns null for unknown ids", () => {
    expect(habitTemplateFor("nope", "ar")).toBeNull();
  });
});

describe("TASK_TEMPLATES", () => {
  it("ships two Arabic-first templates", () => {
    expect(TASK_TEMPLATES.map((x) => x.id)).toEqual(["focus", "review"]);
    for (const tpl of TASK_TEMPLATES) {
      expect(tpl.title.ar.trim()).not.toBe("");
      expect(tpl.title.en.trim()).not.toBe("");
    }
  });
});

describe("taskTemplateFor", () => {
  it("returns the locale copy", () => {
    expect(taskTemplateFor("focus", "ar")?.title).toBe("جلسة عمل مركّزة");
    expect(taskTemplateFor("review", "en")?.priority).toBe("medium");
    expect(taskTemplateFor("review", "en")?.recurrence?.freq).toBe("weekly");
  });
  it("returns null for unknown ids", () => {
    expect(taskTemplateFor("nope", "ar")).toBeNull();
  });
});
