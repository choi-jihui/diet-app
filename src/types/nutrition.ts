export interface WeeklyLossRange {
  min: number;
  max: number;
}

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  targetCalories: number;
  proteinGoalG: number;
  waterGoalMl: number;
  expectedWeeklyLossKgRange: WeeklyLossRange;
  cautionNote?: string;
}
