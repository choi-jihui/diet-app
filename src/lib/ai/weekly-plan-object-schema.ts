import { z } from "zod";
import { MEAL_OPTION_TYPES, MEAL_SLOTS } from "@/lib/ai/schemas";

/** streamObject용 정적 스키마. 생성 후 buildWeeklyPlanResponseSchema로 엄격 검증한다. */
const mealIngredientLineSchema = z.object({
  name: z.string(),
  amount: z.string(),
  fromFridge: z.boolean(),
});

const mealOptionObjectSchema = z.object({
  type: z.enum(MEAL_OPTION_TYPES),
  title: z.string(),
  ingredients: z.array(mealIngredientLineSchema).max(5),
  steps: z.array(z.string()).max(3),
  estimatedCalories: z.number(),
  estimatedProteinG: z.number(),
  prepMinutes: z.number(),
  why: z.string(),
});

const plannedMealObjectSchema = z.object({
  mealType: z.enum(MEAL_SLOTS),
  targetCalories: z.number(),
  options: z.array(mealOptionObjectSchema).length(3),
});

const dailyPlanObjectSchema = z.object({
  date: z.string(),
  dayLabel: z.string(),
  meals: z.array(plannedMealObjectSchema),
  coachNote: z.string(),
});

const shoppingSuggestionObjectSchema = z.object({
  name: z.string(),
  reason: z.string(),
  priority: z.enum(["optional", "recommended"]),
});

const unmanagedMealCaloriesObjectSchema = z.object({
  min: z.number(),
  max: z.number(),
  note: z.string(),
});

export const weeklyMealPlanObjectSchema = z.object({
  weekStartDate: z.string(),
  dailyPlans: z.array(dailyPlanObjectSchema).length(7),
  shoppingSuggestions: z.array(shoppingSuggestionObjectSchema).max(10),
  unmanagedMealCalories: unmanagedMealCaloriesObjectSchema,
  safetyNote: z.string(),
});

export type WeeklyMealPlanObject = z.infer<typeof weeklyMealPlanObjectSchema>;
