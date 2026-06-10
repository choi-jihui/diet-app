import type { NutritionTargets } from "@/types/nutrition";
import type { ActivityLevel, DietIntensity, UserProfile } from "@/types/user";
import { calculateBmr } from "./bmr";
import { calculateWaterGoalMl } from "./water";
import { calculateWeeklyLossRange } from "./weight-loss-range";

export const MIN_TARGET_CALORIES = 1200;

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

const DIET_DEFICIT: Record<DietIntensity, number> = {
  light: 250,
  normal: 400,
  intensive: 550,
};

const PROTEIN_MULTIPLIER: Record<DietIntensity, number> = {
  light: 1.2,
  normal: 1.4,
  intensive: 1.6,
};

const INTENSIVE_CAUTION_NOTE =
  "강한 페이스는 단기적으로만 추천해요. 피로, 어지러움, 폭식 욕구, 수면 부족이 느껴지면 강도를 낮춰보세요.";

export function calculateTdee(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

export function calculateTargetCalories(
  tdee: number,
  dietIntensity: DietIntensity,
): number {
  const rawTarget = tdee - DIET_DEFICIT[dietIntensity];
  return Math.max(MIN_TARGET_CALORIES, Math.round(rawTarget));
}

export function calculateProteinGoalG(
  weightKg: number,
  dietIntensity: DietIntensity,
): number {
  return Math.round(weightKg * PROTEIN_MULTIPLIER[dietIntensity]);
}

export function calculateNutritionTargets(profile: UserProfile): NutritionTargets {
  const bmr = calculateBmr({
    gender: profile.gender,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    age: profile.age,
  });

  const tdee = calculateTdee(bmr, profile.activityLevel);
  const targetCalories = calculateTargetCalories(tdee, profile.dietIntensity);
  const proteinGoalG = calculateProteinGoalG(profile.weightKg, profile.dietIntensity);
  const waterGoalMl = calculateWaterGoalMl(profile.weightKg);
  const expectedWeeklyLossKgRange = calculateWeeklyLossRange(tdee, targetCalories);

  const targets: NutritionTargets = {
    bmr,
    tdee,
    targetCalories,
    proteinGoalG,
    waterGoalMl,
    expectedWeeklyLossKgRange,
  };

  if (profile.dietIntensity === "intensive") {
    targets.cautionNote = INTENSIVE_CAUTION_NOTE;
  }

  return targets;
}
