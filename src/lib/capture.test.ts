import { describe, expect, it } from "vitest";
import { captureFromText, isBareUrl } from "./capture";

const today = "2026-11-16";

describe("capture", () => {
  it("empty input yields an empty note result", () => {
    expect(captureFromText("", today)).toEqual({
      kind: "note",
      title: "",
      body: "",
      tags: [],
      priority: undefined,
      dueDate: undefined,
    });
  });

  it("note prefix (en and ar)", () => {
    expect(captureFromText("note: buy milk today", today).kind).toBe("note");
    expect(captureFromText("Ù…Ù„Ø§Ø­Ø¸Ø©: Ø§Ø´ØªØ±Ù Ø§Ù„Ù„Ø¨Ù†", today).kind).toBe("note");
  });

  it("task prefix (en and ar)", () => {
    const t = captureFromText("task: reply to emails", today);
    expect(t.kind).toBe("task");
    expect(t.title).toBe("reply to emails");
    const ta = captureFromText("Ù…Ù‡Ù…Ø©: Ø±Ø¯ Ø¹Ù„Ù‰ Ø§Ù„Ø±Ø³Ø§Ø¦Ù„", today);
    expect(ta.kind).toBe("task");
  });

  it("single line -> task, parseQuickAdd applied", () => {
    const t = captureFromText("!high #work buy milk tomorrow", today);
    expect(t.kind).toBe("task");
    expect(t.priority).toBe("high");
    expect(t.tags).toEqual(["work"]);
    expect(t.dueDate).toBe("2026-11-17");
  });

  it("multi-line -> note, title = first line", () => {
    const n = captureFromText("Meeting notes\n- agenda item one\n- agenda item two", today);
    expect(n.kind).toBe("note");
    expect(n.title).toBe("Meeting notes");
    expect(n.body).toContain("agenda item one");
  });

  it("long single line -> note", () => {
    const n = captureFromText("x".repeat(300), today);
    expect(n.kind).toBe("note");
    expect(n.title).toBe("x".repeat(120));
  });

  it("bare url -> note", () => {
    const n = captureFromText("https://example.com/page", today);
    expect(n.kind).toBe("note");
    expect(n.title).toBe("https://example.com/page");
    expect(n.body).toBe("https://example.com/page");
    expect(isBareUrl("https://example.com")).toBe(true);
    expect(isBareUrl("not a url")).toBe(false);
  });

  it("empty title falls back to raw input", () => {
    const t = captureFromText("!high", today);
    expect(t.kind).toBe("task");
    expect(t.title).toBe("!high");
  });
});
