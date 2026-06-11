import type { MealSlot } from "@/types/user";

export type InstantRecommendationMode = "fridge" | "dining";

export type HungerLevel = "light" | "normal" | "very_hungry";

export type MealStyle = "light" | "filling" | "lazy";

export type MaxPrepMinutes = 5 | 10 | 20 | 30;

export interface InstantFridgeRequestPayload {
  mealSlot: MealSlot;
  preferredIngredients: string[];
  excludedIngredients: string[];
  hungerLevel: HungerLevel;
  maxPrepMinutes: MaxPrepMinutes;
  style: MealStyle;
}

export interface InstantDiningRequestPayload {
  mealSlot: MealSlot;
  category: string;
  candidateMenus: string[];
  budgetText?: string;
  hungerLevel: HungerLevel;
  remainingCalories?: number;
}

export interface InstantFridgeIngredient {
  name: string;
  amount: string;
  fromFridge: boolean;
}

export interface InstantFridgeRecommendation {
  title: string;
  ingredients: InstantFridgeIngredient[];
  steps: string[];
  estimatedCalories: number;
  estimatedProteinG: number;
  prepMinutes: number;
  why: string;
}

export interface InstantDiningCaloriesRange {
  min: number;
  max: number;
}

export interface InstantDiningRecommendation {
  menuName: string;
  category: string;
  estimatedCaloriesRange: InstantDiningCaloriesRange;
  proteinEstimateG?: number;
  orderTips: string[];
  portionTips: string[];
  why: string;
  balanceTip: string;
}
