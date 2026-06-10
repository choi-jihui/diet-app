export type Gender = "female" | "male" | "other";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active";

export type DietIntensity = "light" | "normal" | "intensive";

export type CardioIntensity = "none" | "two_days" | "three_days" | "five_days";

export type MealSlot = "breakfast" | "lunch" | "dinner";

export interface UserProfile {
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  goalWeightKg: number;
  activityLevel: ActivityLevel;
  dietIntensity: DietIntensity;
  cardioIntensity: CardioIntensity;
  selectedMealSlots: MealSlot[];
  allergies: string[];
  dislikedFoods: string[];
  cookingTools: string[];
}
