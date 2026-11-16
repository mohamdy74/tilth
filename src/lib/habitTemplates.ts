import type { HabitSchedule, Settings } from "./types";

export type HabitTemplateLocale = Settings["language"];

export interface HabitTemplate {
  id: string;
  /** The template's name in each locale — written separately per locale, never machine-translated. */
  name: Record<HabitTemplateLocale, string>;
  schedule: HabitSchedule;
  /** Optional one-line hint shown under the name. */
  hint: Record<HabitTemplateLocale, string>;
}

/*
 * Hand-written Arabic and English habit templates — no machine
 * translation, no shared skeleton. Ids are stable: they are persisted.
 */
export const HABIT_TEMPLATES: HabitTemplate[] = [
  {
    id: "water",
    name: { ar: "شرب الماء", en: "Drink Water" },
    schedule: { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
    hint: { ar: "ثمانية أكواب على مدار اليوم", en: "Eight glasses through the day" },
  },
  {
    id: "exercise",
    name: { ar: "أيام التمرين", en: "Workout Days" },
    schedule: { type: "custom", days: [0, 2, 4] },
    hint: { ar: "تمارين مقاومة ثلاث مرات في الأسبوع", en: "Strength training three times a week" },
  },
  {
    id: "read",
    name: { ar: "القراءة اليومية", en: "Read Daily" },
    schedule: { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
    hint: { ar: "بضع صفحات من أي كتاب", en: "A few pages of any book" },
  },
  {
    id: "meditate",
    name: { ar: "تأمل يومي", en: "Daily Meditation" },
    schedule: { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
    hint: { ar: "عشر دقائق هادئة بلا هاتف", en: "Ten quiet minutes without a phone" },
  },
  {
    id: "walk",
    name: { ar: "مشي المساء", en: "Evening Walk" },
    schedule: { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
    hint: { ar: "عشرون دقيقة في الهواء الطلق", en: "Twenty minutes of fresh air" },
  },
  {
    id: "sleep",
    name: { ar: "النوم المبكر", en: "Early Sleep" },
    schedule: { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
    hint: { ar: "النوم قبل الحادية عشرة مساءً", en: "Lights out before eleven" },
  },
  {
    id: "journal",
    name: { ar: "مذكرات المساء", en: "Evening Journal" },
    schedule: { type: "custom", days: [1, 2, 3, 4, 5] },
    hint: { ar: "دوّن ملامح اليوم في أيام العمل", en: "Write down the day on weekdays" },
  },
  {
    id: "screenless",
    name: { ar: "ساعة بلا شاشات", en: "Screenless Hour" },
    schedule: { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
    hint: { ar: "ساعة واحدة بلا أي شاشة", en: "One hour without any screen" },
  },
];

/** The template for the asked id in the asked locale, or null for unknown ids. */
export function templateFor(id: string, locale: HabitTemplateLocale): HabitTemplate | null {
  const tpl = HABIT_TEMPLATES.find((t) => t.id === id);
  if (!tpl) return null;
  return tpl.name[locale] ? tpl : null;
}

/** Every template that has copy in the asked locale — a new array, the source is never mutated. */
export function templatesFor(locale: HabitTemplateLocale): HabitTemplate[] {
  return HABIT_TEMPLATES.filter((t) => t.name[locale] && t.hint[locale]).map((t) => ({ ...t }));
}
