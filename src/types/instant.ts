import type { MealSlot } from "@/types/user";

export type InstantRecommendationMode = "fridge" | "dining";

export type HungerLevel = "light" | "normal" | "heavy";

export type MealStyle = "light" | "filling" | "simple";

export type CookingTimeBudget = "10min" | "20min" | "30min_plus";

/** 향후 Gemini fridge 모드 입력용 초안 */
export interface FridgeRecommendationInput {
  mode: "fridge";
  mealSlot: MealSlot;
  wantedIngredients: string[];
  excludedIngredients: string[];
  hungerLevel: HungerLevel;
  cookingTimeBudget: CookingTimeBudget;
  mealStyle: MealStyle;
}

/** 향후 Gemini dining 모드 입력용 초안 */
export interface DiningRecommendationInput {
  mode: "dining";
  category: string;
  menuConsideration: string;
  budget?: number;
  hungerLevel: HungerLevel;
  remainingCalories?: number;
}

export type InstantRecommendationInput =
  | FridgeRecommendationInput
  | DiningRecommendationInput;
