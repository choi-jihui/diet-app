import type { MealSlot } from "@/types/user";

export const MEAL_SLOT_ORDER: MealSlot[] = ["breakfast", "lunch", "dinner"];

export const MEAL_SLOT_OPTIONS: { value: MealSlot; label: string }[] = [
  { value: "breakfast", label: "아침" },
  { value: "lunch", label: "점심" },
  { value: "dinner", label: "저녁" },
];

export function getMealSlotLabel(slot: MealSlot): string {
  return MEAL_SLOT_OPTIONS.find((option) => option.value === slot)?.label ?? slot;
}

export function formatMealSlotsLabel(slots: MealSlot[]): string {
  return MEAL_SLOT_ORDER.filter((slot) => slots.includes(slot))
    .map(getMealSlotLabel)
    .join(", ");
}

export const DEFAULT_MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

export function isMealSlot(value: unknown): value is MealSlot {
  return value === "breakfast" || value === "lunch" || value === "dinner";
}

export function normalizeMealSlots(slots: unknown): MealSlot[] | null {
  if (!Array.isArray(slots) || slots.length === 0) {
    return null;
  }

  const normalized = MEAL_SLOT_ORDER.filter(
    (slot) => slots.includes(slot),
  );

  return normalized.length > 0 ? normalized : null;
}
