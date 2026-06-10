import type { WeeklyLossRange } from "@/types/nutrition";

const KCAL_PER_KG = 7700;

export function calculateWeeklyLossRange(
  tdee: number,
  targetCalories: number,
): WeeklyLossRange {
  const dailyDeficit = Math.max(0, tdee - targetCalories);
  const weeklyDeficit = dailyDeficit * 7;
  const expectedKg = weeklyDeficit / KCAL_PER_KG;

  const min = Math.max(0, roundOneDecimal(expectedKg * 0.8));
  const max = roundOneDecimal(expectedKg * 1.2);

  return { min, max };
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
