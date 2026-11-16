import type { Habit, Note, Task } from "./types";

/*
 * Universal search across tasks, notes and habits — pure, locale-aware
 * (Arabic diacritics/alef variants are normalized on both sides).
 */

export type SearchKind = "task" | "note" | "habit";

export interface SearchHit {
  id: string;
  kind: SearchKind;
  title: string;
  snippet: string;
  matched: string[];
}

export interface SearchOptions {
  perKind?: number;
  limit?: number;
}

const KIND_RANK: Record<SearchKind, number> = { task: 0, note: 1, habit: 2 };

/** Lowercase + Arabic normalization so "الصَّلاة" matches "الصلاه". */
export function normalizeText(s: string): string {
  const out: string[] = [];
  for (const ch of s.toLowerCase()) {
    const cp = ch.codePointAt(0)!;
    // strip Arabic diacritics (U+064B..U+0652) and alef superscript (U+0670)
    if ((cp >= 0x064b && cp <= 0x0652) || cp === 0x0670) continue;
    // alef variants -> ا, dotless ye -> ي, ta-marbuta -> ه
    if (cp === 0x0623 || cp === 0x0625 || cp === 0x0622 || cp === 0x0671) {
      out.push("ا");
      continue;
    }
    if (cp === 0x0649) {
      out.push("ي");
      continue;
    }
    if (cp === 0x0629) {
      out.push("ه");
      continue;
    }
    out.push(ch);
  }
  return out.join("");
}

interface Candidate {
  hit: SearchHit;
  titleMatch: boolean;
}

export function searchAll(
  input: { tasks: Task[]; notes: Note[]; habits: Habit[] },
  query: string,
  options?: SearchOptions,
): SearchHit[] {
  const q = normalizeText(query.trim());
  if (q.length < 2) return [];
  const perKind = options?.perKind ?? 8;
  const limit = options?.limit ?? 24;

  const candidates: Candidate[] = [];
  // fields[0] is always the title, so a match there outranks everything else.
  const push = (hit: SearchHit, fields: string[]) => {
    const norm = fields.map(normalizeText);
    if (!norm.some((f) => f.includes(q))) return;
    candidates.push({ hit, titleMatch: norm[0]!.includes(q) });
  };

  for (const t of input.tasks) {
    if (t.deletedAt) continue;
    push(
      {
        id: t.id,
        kind: "task",
        title: t.title,
        snippet: t.notes?.trim() || t.tags.map((x) => `#${x}`).join(" "),
        matched: [t.title, t.notes ?? "", ...t.tags],
      },
      [t.title, t.notes ?? "", ...t.tags],
    );
  }
  for (const n of input.notes) {
    if (n.deletedAt) continue;
    const body = n.body;
    const idx = normalizeText(body).indexOf(q);
    let snippet = "";
    if (idx >= 0) {
      const from = Math.max(0, idx - 30);
      snippet =
        (from > 0 ? "\u2026" : "") +
        body.slice(from, from + 120).trim() +
        (from + 120 < body.length ? "\u2026" : "");
    }
    push({ id: n.id, kind: "note", title: n.title, snippet, matched: [n.title, n.body] }, [
      n.title,
      n.body,
    ]);
  }
  for (const h of input.habits) {
    if (h.deletedAt || h.archived) continue;
    push({ id: h.id, kind: "habit", title: h.name, snippet: "", matched: [h.name] }, [h.name]);
  }

  candidates.sort((a, b) => {
    if (a.titleMatch !== b.titleMatch) return a.titleMatch ? -1 : 1;
    if (a.hit.title.length !== b.hit.title.length) return a.hit.title.length - b.hit.title.length;
    const byTitle = a.hit.title.localeCompare(b.hit.title);
    if (byTitle !== 0) return byTitle;
    if (KIND_RANK[a.hit.kind] !== KIND_RANK[b.hit.kind])
      return KIND_RANK[a.hit.kind] - KIND_RANK[b.hit.kind];
    return a.hit.id.localeCompare(b.hit.id);
  });

  const quota = { task: 0, note: 0, habit: 0 };
  const out: SearchHit[] = [];
  for (const c of candidates) {
    if (out.length >= limit) break;
    if (quota[c.hit.kind] >= perKind) continue;
    quota[c.hit.kind]++;
    out.push(c.hit);
  }
  return out;
}
