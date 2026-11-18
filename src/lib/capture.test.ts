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
    expect(captureFromText("ملاحظة: اشترِ اللبن", today).kind).toBe("note");
  });

  it("task prefix (en and ar)", () => {
    const t = captureFromText("task: reply to emails", today);
    expect(t.kind).toBe("task");
    expect(t.title).toBe("reply to emails");
    const ta = captureFromText("مهمة: رد على الرسائل", today);
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

describe("capture beyond tasks", () => {
  it("habit prefix creates a daily habit intent (en and ar)", () => {
    const h = captureFromText("habit: read 20 pages #reading", today);
    expect(h.kind).toBe("habit");
    expect(h.title).toBe("read 20 pages");
    expect(h.tags).toEqual(["reading"]);
    const ha = captureFromText("عادة: قراءة يومية", today);
    expect(ha.kind).toBe("habit");
    expect(ha.title).toBe("قراءة يومية");
  });

  it("focus prefix parses minutes, ascii and arabic-indic digits", () => {
    const f = captureFromText("focus 50", today);
    expect(f.kind).toBe("focus");
    expect(f.minutes).toBe(50);
    const fa = captureFromText("ركز ٥٠", today);
    expect(fa.kind).toBe("focus");
    expect(fa.minutes).toBe(50);
    const bare = captureFromText("تركيز", today);
    expect(bare.kind).toBe("focus");
    expect(bare.minutes).toBe(25);
  });

  it("focus minutes clamp to 1..180", () => {
    expect(captureFromText("focus 999", today).minutes).toBe(180);
    expect(captureFromText("focus 0", today).minutes).toBe(1);
  });

  it("forced prefixes win over the length heuristic", () => {
    const long = "task: " + "x".repeat(300);
    expect(captureFromText(long, today).kind).toBe("task");
  });
});
