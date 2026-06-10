import type { MealSlot } from "@/types/user";
import { getMealSlotLabel } from "@/constants/meal-slots";

export interface MockPlannedMeal {
  slot: MealSlot;
  menuName: string;
  estimatedCalories: number;
}

const MOCK_MEALS_BY_SLOT: Record<MealSlot, MockPlannedMeal> = {
  breakfast: {
    slot: "breakfast",
    menuName: "그릭요거트 볼",
    estimatedCalories: 320,
  },
  lunch: {
    slot: "lunch",
    menuName: "닭가슴살 샐러드",
    estimatedCalories: 450,
  },
  dinner: {
    slot: "dinner",
    menuName: "참치 야채볶음",
    estimatedCalories: 480,
  },
};

export function getMockPlannedMeals(slots: MealSlot[]): MockPlannedMeal[] {
  return slots.map((slot) => MOCK_MEALS_BY_SLOT[slot]);
}

export function getMockMealLabel(meal: MockPlannedMeal): string {
  return `${getMealSlotLabel(meal.slot)} · ${meal.menuName}`;
}
