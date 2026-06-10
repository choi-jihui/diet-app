export type NavIconName =
  | "home"
  | "fridge"
  | "meal"
  | "cardio"
  | "log"
  | "report";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
}

export const MAIN_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "홈", icon: "home" },
  { href: "/diet", label: "식단", icon: "meal" },
  { href: "/cardio", label: "운동", icon: "cardio" },
  { href: "/log", label: "기록", icon: "log" },
  { href: "/report", label: "리포트", icon: "report" },
];

export const SECONDARY_LINKS = [
  { href: "/instant", label: "지금 뭐 먹지?" },
] as const;
