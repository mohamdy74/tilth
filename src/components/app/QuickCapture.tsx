import { useMemo, useRef, useState } from "react";
import { CalendarDays, CornerDownLeft, Hash, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { usePrefs } from "./preferences";
import { OUTLINE_BTN, PRIMARY_BTN } from "@/components/ui/button";
import { formatDate } from "@/lib/i18n";
import { parseQuickAdd } from "@/lib/quickAdd";
import { tasks as taskApi, todayLocal } from "@/lib/store";

/**
 * Global quick capture (press "n" anywhere, or use the sidebar / ⌘K).
 * Deliberately a single field: type, Enter, keep typing. The parse result is
 * shown as live chips — the quick-add grammar is visible while you type
 * instead of vanishing with the placeholder, so nothing has to be remembered.
 * Stays open after adding for rapid capture; Esc or the backdrop closes it.
 */
export function QuickCapture({ onClose }: { onClose: () => void }) {
  const { t, locale } = usePrefs();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parseQuickAdd(draft, todayLocal()), [draft]);
  const canAdd = parsed.title.trim().length > 0;

  const add = () => {
    if (!canAdd) return;
    taskApi.add({
      title: parsed.title,
      priority: parsed.priority ?? "medium",
      tags: parsed.tags,
      dueDate: parsed.dueDate,
    });
    toast(t.capture.added);
    setDraft("");
    inputRef.current?.focus();
  };

  return (
    <Modal title={t.capture.title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
          <h2 className="font-display text-lg font-semibold">{t.capture.title}</h2>
        </div>
        <label className="mt-1 block text-xs text-muted-foreground">{t.capture.placeholder}</label>
        <input
          ref={inputRef}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
          placeholder={t.tasks.quickAddPlaceholder}
          aria-label={t.capture.title}
          className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
          dir="auto"
        />

        <div className="mt-2 min-h-6 flex flex-wrap items-center gap-1.5">
          {canAdd && (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                {t.tasks.priority[parsed.priority ?? "medium"]}
              </span>
              {parsed.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-0.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  <Hash className="size-2.5" aria-hidden />
                  {tag}
                </span>
              ))}
              {parsed.dueDate && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  <CalendarDays className="size-2.5" aria-hidden />
                  {formatDate(locale, new Date(parsed.dueDate + "T12:00:00Z"), {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </>
          )}
        </div>

        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <CornerDownLeft className="size-3" aria-hidden />
          {t.capture.hint}
        </p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className={OUTLINE_BTN}>
            {t.capture.close}
          </button>
          <button type="submit" disabled={!canAdd} className={PRIMARY_BTN}>
            <Plus className="size-4" aria-hidden />
            {t.tasks.add}
          </button>
        </div>
      </form>
    </Modal>
  );
}
