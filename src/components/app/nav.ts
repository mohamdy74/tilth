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

/** ترتيب الوحدات الأصلي usato لتحديد أول 4 تظهر في الشريط السفلي. */
export const MOBILE_ORDER: NavKey[] = [
  "dashboard",
  "plan",
  "calendar",
  "tasks",
  "notes",
  "habits",
  "focus",
  "rewards",
  "insights",
];

/** الحد الأدنى والأقصى للعناصر الظاهرة في الشريط السفلي (باستثناء زر "المزيد"). */
export const MOBILE_BAR_MIN = 2;
export const MOBILE_BAR_MAX = 4;
