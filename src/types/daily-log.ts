import type { DailyLogCardio } from "@/types/cardio";
import type { MealOptionType, MealSlotType } from "@/types/meal";
import type { NutritionTargets } from "@/types/nutrition";
import type { UserProfile } from "@/types/user";

export type MealLogStatus = "unlogged" | "planned" | "custom" | "skipped";

export type FoodCategory = "breakfast" | "lunch" | "dinner" | "snack" | "drink";

/** 주간 식단을 재생성해도 과거 기록이 유지되도록 선택 시점 값을 복사한다. */
export interface PlannedMealSnapshot {
  optionType: MealOptionType;
  title: string;
  estimatedCalories: number;
  estimatedProteinG: number;
}

export interface CustomFoodEntry {
  id: string;
  name: string;
  calories: number;
  proteinG?: number;
}

export interface FoodEntry extends CustomFoodEntry {
  category: FoodCategory;
}

/**
 * Firestore에는 unlogged를 저장하지 않는다.
 * meals.{slot} 필드 부재 = unlogged.
 */
export interface MealLog {
  slot: MealSlotType;
  status: Exclude<MealLogStatus, "unlogged">;
  plannedOption?: PlannedMealSnapshot;
  customEntries?: CustomFoodEntry[];
}

/** 해당 날짜 기록 시점의 목표값 snapshot. 프로필 재설정 후에도 유지한다. */
export interface DailyGoalsSnapshot {
  targetCalories: number;
  waterGoalMl: number;
  proteinGoalG: number;
  managedMealSlots: MealSlotType[];
}

export function buildDailyGoalsSnapshot(
  profile: UserProfile,
  targets: NutritionTargets,
): DailyGoalsSnapshot {
  return {
    targetCalories: targets.targetCalories,
    waterGoalMl: targets.waterGoalMl,
    proteinGoalG: targets.proteinGoalG,
    managedMealSlots: [...profile.selectedMealSlots],
  };
}

export interface DailyLog {
  date: string;
  goalsSnapshot?: DailyGoalsSnapshot;
  meals?: Partial<Record<MealSlotType, MealLog>>;
  extraFoods?: FoodEntry[];
  waterMl?: number;
  sleepHours?: number;
  weightKg?: number;
  cardio?: DailyLogCardio;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const WATER_MAX_ML = 10000;
export const FOOD_CALORIES_MAX = 5000;
export const FOOD_PROTEIN_MAX_G = 300;
export const SLEEP_MAX_HOURS = 24;
export const WEIGHT_MIN_KG = 30;
export const WEIGHT_MAX_KG = 300;
