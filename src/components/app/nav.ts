import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  Gift,
  LayoutDashboard,
  Layout,
  Repeat,
  Settings,
  StickyNote,
  Timer,
  type LucideIcon,
} from "lucide-react";

export type NavKey =
  | "dashboard"
  | "plan"
  | "calendar"
  | "tasks"
  | "notes"
  | "habits"
  | "focus"
  | "rewards"
  | "insights"
  | "settings";
export type NavItem = {
  key: NavKey;
  to:
    | "/"
    | "/plan"
    | "/calendar"
    | "/tasks"
    | "/notes"
    | "/habits"
    | "/focus"
    | "/rewards"
    | "/insights"
    | "/settings";
  icon: LucideIcon;
};

export const NAV: NavItem[] = [
  { key: "dashboard", to: "/", icon: LayoutDashboard },
  { key: "plan", to: "/plan", icon: Layout },
  { key: "calendar", to: "/calendar", icon: CalendarDays },
  { key: "tasks", to: "/tasks", icon: CheckSquare },
  { key: "notes", to: "/notes", icon: StickyNote },
  { key: "habits", to: "/habits", icon: Repeat },
  { key: "focus", to: "/focus", icon: Timer },
  { key: "rewards", to: "/rewards", icon: Gift },
  { key: "insights", to: "/insights", icon: BarChart3 },
  { key: "settings", to: "/settings", icon: Settings },
];

/** عناصر الشريط الأساسي في شريط الجوال الأسفل (تظهر أولًا، يتمركز عند الإخفاء). */
export const MOBILE_PRIMARY: NavKey[] = ["dashboard", "plan", "tasks", "focus", "habits"];
/** عناصر قائمة "المزيد" في شريط الجوال (تظهر دائمًا ضمن "المزيد"). */
export const MOBILE_MORE: NavKey[] = ["calendar", "notes", "rewards", "insights", "settings"];
