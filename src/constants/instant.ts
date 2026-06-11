import type { HungerLevel, MaxPrepMinutes, MealStyle } from "@/types/instant";

export const HUNGER_LEVEL_OPTIONS: { value: HungerLevel; label: string }[] = [
  { value: "light", label: "가볍게" },
  { value: "normal", label: "보통" },
  { value: "very_hungry", label: "많이 배고픔" },
];

export const MEAL_STYLE_OPTIONS: { value: MealStyle; label: string }[] = [
  { value: "light", label: "가볍게" },
  { value: "filling", label: "든든하게" },
  { value: "lazy", label: "간단하게" },
];

export const COOKING_TIME_OPTIONS: { value: MaxPrepMinutes; label: string }[] = [
  { value: 5, label: "5분" },
  { value: 10, label: "10분" },
  { value: 20, label: "20분" },
  { value: 30, label: "30분" },
];

export const DINING_CATEGORY_OPTIONS = [
  "한식",
  "중식",
  "일식",
  "양식",
  "분식",
  "패스트푸드",
  "카페",
  "편의점",
  "직접 입력",
] as const;

export type DiningCategory = (typeof DINING_CATEGORY_OPTIONS)[number];
