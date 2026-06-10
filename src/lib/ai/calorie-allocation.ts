import type { UnmanagedMealCalories } from "@/types/meal";
import type { MealSlot } from "@/types/user";

export const MEAL_SLOT_RATIOS: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.4,
};

export const MEAL_SLOT_LABELS_KO: Record<MealSlot, string> = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
};

export interface SlotBudget {
  slot: MealSlot;
  budget: number;
}

/** 선택한 끼니만 하루 전체 목표 비율로 예산을 잡는다. 미선택 끼니로 몰아주지 않는다. */
export function computeSlotBudgets(
  targetCalories: number,
  selectedSlots: MealSlot[],
): SlotBudget[] {
  return selectedSlots.map((slot) => ({
    slot,
    budget: Math.round(targetCalories * MEAL_SLOT_RATIOS[slot]),
  }));
}

/** 하루 목표에서 관리 끼니 예산을 뺀 나머지를 ±15% 현실 범위로 표현한다. */
export function computeUnmanagedRange(
  targetCalories: number,
  selectedSlots: MealSlot[],
): UnmanagedMealCalories {
  const managed = selectedSlots.reduce(
    (sum, slot) => sum + targetCalories * MEAL_SLOT_RATIOS[slot],
    0,
  );
  const leftover = Math.max(0, targetCalories - managed);
  const min = Math.max(0, Math.round(leftover * 0.85));
  const max = Math.max(min, Math.round(leftover * 1.15));

  return {
    min,
    max,
    note: "급식·회사밥 등 앱이 관리하지 않는 끼니에 활용할 수 있는 예상 범위예요.",
  };
}
