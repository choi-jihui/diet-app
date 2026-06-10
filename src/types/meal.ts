export type MealSlotType = "breakfast" | "lunch" | "dinner";

export type MealOptionType = "fat_loss" | "filling" | "lazy";

export interface MealIngredientLine {
  name: string;
  amount: string;
  fromFridge: boolean;
}

export interface MealOption {
  type: MealOptionType;
  title: string;
  ingredients: MealIngredientLine[];
  steps: string[];
  estimatedCalories: number;
  estimatedProteinG: number;
  prepMinutes: number;
  why: string;
}

export interface PlannedMeal {
  mealType: MealSlotType;
  targetCalories: number;
  options: MealOption[];
}

export interface DailyPlan {
  date: string;
  dayLabel: string;
  meals: PlannedMeal[];
  coachNote: string;
}

export interface ShoppingSuggestion {
  name: string;
  reason: string;
  priority: "optional" | "recommended";
}

export interface UnmanagedMealCalories {
  min: number;
  max: number;
  note: string;
}

export interface WeeklyMealPlan {
  weekStartDate: string;
  dailyPlans: DailyPlan[];
  shoppingSuggestions: ShoppingSuggestion[];
  unmanagedMealCalories: UnmanagedMealCalories;
  safetyNote: string;
}

export interface StoredWeeklyMealPlan {
  plan: WeeklyMealPlan;
  schemaVersion: number;
}
