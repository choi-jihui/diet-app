import { z } from "zod";
import type { MaxPrepMinutes } from "@/types/instant";

const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;
const HUNGER_LEVELS = ["light", "normal", "very_hungry"] as const;
const STYLES = ["light", "filling", "lazy"] as const;

const SHORT_TEXT_MAX = 40;
const LIST_ITEM_MAX = 20;

const trimmedShortText = z.string().trim().min(1).max(SHORT_TEXT_MAX);

function hasDuplicate(items: string[]): boolean {
  return new Set(items).size !== items.length;
}

export const instantFridgeRequestSchema = z
  .object({
    mealSlot: z.enum(MEAL_SLOTS),
    preferredIngredients: z.array(trimmedShortText).max(LIST_ITEM_MAX).default([]),
    excludedIngredients: z.array(trimmedShortText).max(LIST_ITEM_MAX).default([]),
    hungerLevel: z.enum(HUNGER_LEVELS),
    maxPrepMinutes: z.union([z.literal(5), z.literal(10), z.literal(20), z.literal(30)]),
    style: z.enum(STYLES),
  })
  .superRefine((value, ctx) => {
    const overlap = value.preferredIngredients.filter((item) =>
      value.excludedIngredients.includes(item),
    );
    if (overlap.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "같은 재료를 선호와 제외에 동시에 넣을 수 없어요.",
      });
    }
  });

export const instantDiningRequestSchema = z.object({
  mealSlot: z.enum(MEAL_SLOTS),
  category: trimmedShortText,
  candidateMenus: z.array(trimmedShortText).max(10).default([]),
  budgetText: z.string().trim().max(40).optional(),
  hungerLevel: z.enum(HUNGER_LEVELS),
  remainingCalories: z.number().int().min(0).max(6000).optional(),
});

export const storedProfileSchema = z.object({
  gender: z.enum(["female", "male", "other"]),
  age: z.number().int().min(1).max(120),
  heightCm: z.number().min(50).max(260),
  weightKg: z.number().min(20).max(400),
  goalWeightKg: z.number().min(20).max(400),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active"]),
  dietIntensity: z.enum(["light", "normal", "intensive"]),
  cardioIntensity: z.enum(["none", "two_days", "three_days", "five_days"]),
  selectedMealSlots: z.array(z.enum(MEAL_SLOTS)).min(1).max(3),
  allergies: z.array(z.string().trim().max(SHORT_TEXT_MAX)).max(30),
  dislikedFoods: z.array(z.string().trim().max(SHORT_TEXT_MAX)).max(30),
  cookingTools: z.array(z.string().trim().max(SHORT_TEXT_MAX)).max(30),
});

export const storedNutritionTargetsSchema = z.object({
  bmr: z.number().nonnegative(),
  tdee: z.number().nonnegative(),
  targetCalories: z.number().min(800).max(6000),
  proteinGoalG: z.number().nonnegative(),
  waterGoalMl: z.number().nonnegative(),
  expectedWeeklyLossKgRange: z.object({
    min: z.number(),
    max: z.number(),
  }),
  cautionNote: z.string().max(300).optional(),
});

export const storedProfileDocSchema = z.object({
  profile: storedProfileSchema,
  targets: storedNutritionTargetsSchema,
});

export const storedIngredientDocSchema = z.object({
  name: z.string().trim().min(1).max(SHORT_TEXT_MAX),
  quantityText: z.string().trim().max(SHORT_TEXT_MAX).optional().default(""),
});

export const storedIngredientsSchema = z.array(storedIngredientDocSchema);

const fridgeIngredientSchema = z.object({
  name: z.string().trim().min(1).max(60),
  amount: z.string().trim().max(40).default(""),
  fromFridge: z.boolean(),
});

const fridgeRecommendationSchema = z.object({
  title: z.string().trim().min(1).max(60),
  ingredients: z.array(fridgeIngredientSchema).min(1).max(10),
  steps: z.array(z.string().trim().min(1).max(140)).min(1).max(5),
  estimatedCalories: z.number().int().nonnegative().max(3000),
  estimatedProteinG: z.number().nonnegative().max(300),
  prepMinutes: z.number().int().positive().max(180),
  why: z.string().trim().min(1).max(120),
});

export function buildInstantFridgeResponseSchema(maxPrepMinutes: MaxPrepMinutes) {
  return z
    .object({
      recommendations: z.array(fridgeRecommendationSchema).length(3),
    })
    .superRefine((value, ctx) => {
      const titles = value.recommendations.map((item) => item.title.trim().toLowerCase());
      if (hasDuplicate(titles)) {
        ctx.addIssue({
          code: "custom",
          message: "3개 추천의 제목은 서로 달라야 합니다.",
        });
      }

      value.recommendations.forEach((item, index) => {
        if (item.prepMinutes > maxPrepMinutes) {
          ctx.addIssue({
            code: "custom",
            message: `recommendations[${index}] 조리 시간은 ${maxPrepMinutes}분 이하여야 합니다.`,
          });
        }
      });
    });
}

const calorieRangeSchema = z
  .object({
    min: z.number().int().nonnegative().max(5000),
    max: z.number().int().nonnegative().max(5000),
  })
  .superRefine((value, ctx) => {
    if (value.max < value.min) {
      ctx.addIssue({
        code: "custom",
        message: "estimatedCaloriesRange.max는 min 이상이어야 합니다.",
      });
    }
  });

const diningRecommendationSchema = z.object({
  menuName: z.string().trim().min(1).max(60),
  category: z.string().trim().min(1).max(40),
  estimatedCaloriesRange: calorieRangeSchema,
  proteinEstimateG: z.number().nonnegative().max(300).optional(),
  orderTips: z.array(z.string().trim().min(1).max(120)).min(1).max(3),
  portionTips: z.array(z.string().trim().min(1).max(120)).min(1).max(3),
  why: z.string().trim().min(1).max(120),
  balanceTip: z.string().trim().min(1).max(140),
});

export const instantDiningResponseSchema = z
  .object({
    recommendations: z.array(diningRecommendationSchema).length(3),
  })
  .superRefine((value, ctx) => {
    const menuNames = value.recommendations.map((item) =>
      item.menuName.trim().toLowerCase(),
    );
    if (hasDuplicate(menuNames)) {
      ctx.addIssue({
        code: "custom",
        message: "3개 추천 메뉴는 서로 달라야 합니다.",
      });
    }
  });

export const INSTANT_FRIDGE_RESPONSE_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["recommendations"],
  properties: {
    recommendations: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        required: [
          "title",
          "ingredients",
          "steps",
          "estimatedCalories",
          "estimatedProteinG",
          "prepMinutes",
          "why",
        ],
        properties: {
          title: { type: "string" },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "amount", "fromFridge"],
              properties: {
                name: { type: "string" },
                amount: { type: "string" },
                fromFridge: { type: "boolean" },
              },
            },
          },
          steps: { type: "array", items: { type: "string" } },
          estimatedCalories: { type: "number" },
          estimatedProteinG: { type: "number" },
          prepMinutes: { type: "number" },
          why: { type: "string" },
        },
      },
    },
  },
};

export const INSTANT_DINING_RESPONSE_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["recommendations"],
  properties: {
    recommendations: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        required: [
          "menuName",
          "category",
          "estimatedCaloriesRange",
          "orderTips",
          "portionTips",
          "why",
          "balanceTip",
        ],
        properties: {
          menuName: { type: "string" },
          category: { type: "string" },
          estimatedCaloriesRange: {
            type: "object",
            required: ["min", "max"],
            properties: {
              min: { type: "number" },
              max: { type: "number" },
            },
          },
          proteinEstimateG: { type: "number" },
          orderTips: { type: "array", items: { type: "string" } },
          portionTips: { type: "array", items: { type: "string" } },
          why: { type: "string" },
          balanceTip: { type: "string" },
        },
      },
    },
  },
};

export type InstantFridgeRequest = z.infer<typeof instantFridgeRequestSchema>;
export type InstantDiningRequest = z.infer<typeof instantDiningRequestSchema>;
export type StoredProfileDoc = z.infer<typeof storedProfileDocSchema>;
export type StoredIngredientDoc = z.infer<typeof storedIngredientDocSchema>;
export type InstantFridgeResponse = z.infer<
  ReturnType<typeof buildInstantFridgeResponseSchema>
>;
export type InstantDiningResponse = z.infer<typeof instantDiningResponseSchema>;
