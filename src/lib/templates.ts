import type { HabitSchedule, RecurrenceRule, Settings, Task } from "./types";

export type TemplateId = "study" | "freelance" | "content" | "ramadan";
export type TemplateLocale = Settings["language"];

export interface NoteTemplate {
  id: TemplateId;
  title: Record<TemplateLocale, string>;
  body: Record<TemplateLocale, string>;
}

export interface HabitTemplate {
  id: string;
  name: Record<TemplateLocale, string>;
  schedule: HabitSchedule;
  description: Record<TemplateLocale, string>;
}

export interface TaskTemplate {
  id: string;
  title: Record<TemplateLocale, string>;
  notes?: Record<TemplateLocale, string>;
  priority?: Task["priority"];
  tags?: string[];
  recurrence?: RecurrenceRule;
}

/*
 * Hand-written Arabic and English note templates — no machine
 * translation, no shared skeleton. Each copy was written for its
 * locale by a human, for a human.
 */
export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "study",
    title: { ar: "مذاكرة", en: "Study session" },
    body: {
      ar: "## الهدف\n\n## المواد\n- [ ] \n\n## خطة الجلسة\n- [ ] مراجعة سريعة للدرس الأخير\n- [ ] حل مسائل تدريبية\n- [ ] تلخيص أهم النقاط\n\n## بعد الجلسة\n- ملاحظاتي: ",
      en: "## Goal\n\n## Topics\n- [ ] \n\n## Session plan\n- [ ] Quick review of the last lesson\n- [ ] Practice problems\n- [ ] Summarize the key points\n\n## After\n- My notes: ",
    },
  },
  {
    id: "freelance",
    title: { ar: "عمل حر", en: "Freelance" },
    body: {
      ar: "## المشروع\n\n## مهام هذا الأسبوع\n- [ ] \n\n## عملاء ومتابعات\n- [ ] \n\n## فواتير\n- [ ] ",
      en: "## Project\n\n## This week\n- [ ] \n\n## Clients and follow-ups\n- [ ] \n\n## Invoices\n- [ ] ",
    },
  },
  {
    id: "content",
    title: { ar: "خطة محتوى", en: "Content plan" },
    body: {
      ar: "## فكرة الأسبوع\n\n## منشورات\n- [ ] الاثنين: \n- [ ] الأربعاء: \n- [ ] الجمعة: \n\n## ملاحظات\n- ",
      en: "## This week's idea\n\n## Posts\n- [ ] Monday: \n- [ ] Wednesday: \n- [ ] Friday: \n\n## Notes\n- ",
    },
  },
  {
    id: "ramadan",
    title: { ar: "رمضان", en: "Ramadan" },
    body: {
      ar: "## أهداف رمضان\n\n## العبادة\n- [ ] ورد قراءة يومي\n- [ ] صلاة التراويح\n\n## الروتين\n- [ ] السحور\n- [ ] قيلولة قصيرة\n- [ ] وقت للقراءة قبل الإفطار\n\n## بعد رمضان\n- عادة واحدة سأكملها: ",
      en: "## Ramadan goals\n\n## Worship\n- [ ] Daily Quran portion\n- [ ] Taraweeh prayers\n\n## Routine\n- [ ] Suhoor\n- [ ] A short midday nap\n- [ ] Reading time before iftar\n\n## After Ramadan\n- One habit I will keep: ",
    },
  },
];

/** Bounded habit templates — one-tap starts that keep the system small
 * (one habit at a time, forgiving schedules). */
export const HABIT_TEMPLATES: HabitTemplate[] = [
  {
    id: "morning",
    name: { ar: "روتين الصباح", en: "Morning routine" },
    schedule: { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
    description: {
      ar: "عادة صغيرة تبدأ بها يومك،마다 يوم.",
      en: "One small habit to start every day.",
    },
  },
  {
    id: "deep",
    name: { ar: "بلوك العمل المركّز", en: "Deep work block" },
    schedule: { type: "custom", days: [1, 2, 3, 4, 5] },
    description: {
      ar: "وقت محمي للعمل العميق في أيام الأسبوع.",
      en: "Protected deep-work time on weekdays.",
    },
  },
];

/** Bounded task templates — pre-filled recurring or one-off tasks. */
export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "focus",
    title: { ar: "جلسة عمل مركّزة", en: "Deep work session" },
    notes: {
      ar: "أغلق الإشعارات واعمل على مهمة واحدة.",
      en: "Silence notifications, one task at a time.",
    },
    priority: "high",
    tags: ["focus"],
  },
  {
    id: "review",
    title: { ar: "مراجعة الأسبوع", en: "Weekly review" },
    notes: { ar: "ماذا أنجزت؟ ماذا يؤجل؟", en: "What got done? What got postponed?" },
    priority: "medium",
    tags: ["review"],
    recurrence: { freq: "weekly", interval: 1, byWeekday: [1] },
  },
];

/** The template copy for the asked locale, or null for unknown ids. */
export function templateFor(
  id: string,
  locale: TemplateLocale,
): { title: string; body: string } | null {
  const tpl = NOTE_TEMPLATES.find((t) => t.id === id);
  if (!tpl) return null;
  return { title: tpl.title[locale], body: tpl.body[locale] };
}

/** Habit template copy for the asked locale, or null for unknown ids. */
export function habitTemplateFor(
  id: string,
  locale: TemplateLocale,
): (Omit<HabitTemplate, "name" | "description"> & { name: string; description: string }) | null {
  const tpl = HABIT_TEMPLATES.find((t) => t.id === id);
  if (!tpl) return null;
  return {
    ...tpl,
    name: tpl.name[locale],
    description: tpl.description[locale],
  };
}

/** Task template copy for the asked locale, or null for unknown ids. */
export function taskTemplateFor(
  id: string,
  locale: TemplateLocale,
): (Omit<TaskTemplate, "title" | "notes"> & { title: string; notes?: string | undefined }) | null {
  const tpl = TASK_TEMPLATES.find((t) => t.id === id);
  if (!tpl) return null;
  return {
    ...tpl,
    title: tpl.title[locale],
    notes: tpl.notes ? tpl.notes[locale] : undefined,
  };
}
