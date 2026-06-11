import { z } from "zod";
import { buildWeekDates } from "@/lib/utils/date";

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;
export const MEAL_OPTION_TYPES = ["fat_loss", "filling", "lazy"] as const;

export const AI_LIMITS = {
  maxIngredients: 60,
  maxNameLength: 40,
  maxQuantityLength: 40,
  maxListItems: 30,
  maxListItemLength: 40,
} as const;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** 단일 source of truth: 끼니/알레르기/비선호/조리도구/식단강도는 userProfile 안에만 둔다. */
const userProfileSchema = z.object({
  gender: z.enum(["female", "male", "other"]),
  age: z.number().int().min(1).max(120),
  heightCm: z.number().min(50).max(260),
  weightKg: z.number().min(20).max(400),
  goalWeightKg: z.number().min(20).max(400),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active"]),
  dietIntensity: z.enum(["light", "normal", "intensive"]),
  cardioIntensity: z.enum(["none", "two_days", "three_days", "five_days"]),
  selectedMealSlots: z.array(z.enum(MEAL_SLOTS)).min(1).max(3),
  allergies: z
    .array(z.string().max(AI_LIMITS.maxListItemLength))
    .max(AI_LIMITS.maxListItems),
  dislikedFoods: z
    .array(z.string().max(AI_LIMITS.maxListItemLength))
    .max(AI_LIMITS.maxListItems),
  cookingTools: z
    .array(z.string().max(AI_LIMITS.maxListItemLength))
    .max(AI_LIMITS.maxListItems),
});

const nutritionTargetsSchema = z.object({
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

const ingredientInputSchema = z.object({
  name: z.string().min(1).max(AI_LIMITS.maxNameLength),
  quantityText: z.string().max(AI_LIMITS.maxQuantityLength).default(""),
});

export const generateWeeklyPlanRequestSchema = z.object({
  userProfile: userProfileSchema,
  nutritionTargets: nutritionTargetsSchema,
  ingredients: z.array(ingredientInputSchema).min(1).max(AI_LIMITS.maxIngredients),
  weekStartDate: z.string().regex(YMD),
  fridgeOnly: z.boolean().default(false),
});

export type GenerateWeeklyPlanRequest = z.infer<
  typeof generateWeeklyPlanRequestSchema
>;

const mealIngredientLineSchema = z.object({
  name: z.string().min(1).max(60),
  amount: z.string().max(40).default(""),
  fromFridge: z.boolean(),
});

const mealOptionSchema = z.object({
  type: z.enum(MEAL_OPTION_TYPES),
  title: z.string().min(1).max(50),
  ingredients: z.array(mealIngredientLineSchema).max(4),
  steps: z.array(z.string().max(120)).min(1).max(2),
  estimatedCalories: z.number().int().nonnegative().max(3000),
  estimatedProteinG: z.number().nonnegative().max(300),
  prepMinutes: z.number().int().nonnegative().max(180),
  why: z.string().max(50),
});

const plannedMealSchema = z.object({
  mealType: z.enum(MEAL_SLOTS),
  targetCalories: z.number().int().nonnegative().max(3000),
  options: z.array(mealOptionSchema).length(3).superRefine((options, ctx) => {
    for (const type of MEAL_OPTION_TYPES) {
      if (options.filter((option) => option.type === type).length !== 1) {
        ctx.addIssue({
          code: "custom",
          message: `옵션 type "${type}"은 정확히 한 번만 있어야 합니다.`,
        });
      }
    }
  }),
});

export const dailyPlanSchema = z.object({
  date: z.string().regex(YMD),
  dayLabel: z.string().max(10),
  meals: z.array(plannedMealSchema),
  coachNote: z.string().max(80),
});

const skeletonMealOptionSchema = z.object({
  type: z.enum(MEAL_OPTION_TYPES),
  title: z.string().min(1).max(50),
  estimatedCalories: z.number().int().nonnegative().max(3000),
  estimatedProteinG: z.number().nonnegative().max(300),
  prepMinutes: z.number().int().nonnegative().max(180),
});

const skeletonPlannedMealSchema = z.object({
  mealType: z.enum(MEAL_SLOTS),
  targetCalories: z.number().int().nonnegative().max(3000),
  options: z
    .array(skeletonMealOptionSchema)
    .length(3)
    .superRefine((options, ctx) => {
      for (const type of MEAL_OPTION_TYPES) {
        if (options.filter((option) => option.type === type).length !== 1) {
          ctx.addIssue({
            code: "custom",
            message: `옵션 type "${type}"은 정확히 한 번만 있어야 합니다.`,
          });
        }
      }
    }),
});

export const dailySkeletonSchema = z.object({
  date: z.string().regex(YMD),
  dayLabel: z.string().max(10),
  meals: z.array(skeletonPlannedMealSchema),
});

export const weeklySkeletonSchema = z.object({
  weekStartDate: z.string().regex(YMD),
  dailyPlans: z.array(dailySkeletonSchema).length(7),
});

export type DailySkeleton = z.infer<typeof dailySkeletonSchema>;
export type WeeklySkeleton = z.infer<typeof weeklySkeletonSchema>;

/** 하루치 식단 응답 검증(날짜·선택 끼니 일치). */
export function buildSingleDayPlanResponseSchema(
  expectedDate: string,
  expectedDayLabel: string,
  selectedSlots: readonly (typeof MEAL_SLOTS)[number][],
) {
  const slotSet = new Set(selectedSlots);

  return dailyPlanSchema.superRefine((day, ctx) => {
    if (day.date !== expectedDate) {
      ctx.addIssue({
        code: "custom",
        message: `date는 ${expectedDate} 이어야 합니다.`,
      });
    }
    if (day.dayLabel !== expectedDayLabel) {
      ctx.addIssue({
        code: "custom",
        message: `dayLabel은 ${expectedDayLabel} 이어야 합니다.`,
      });
    }

    const mealTypes = day.meals.map((meal) => meal.mealType);

    for (const mealType of mealTypes) {
      if (!slotSet.has(mealType)) {
        ctx.addIssue({
          code: "custom",
          message: `선택하지 않은 끼니(${mealType})가 포함됐습니다.`,
        });
      }
    }

    for (const slot of selectedSlots) {
      if (mealTypes.filter((type) => type === slot).length !== 1) {
        ctx.addIssue({
          code: "custom",
          message: `끼니 ${slot}은 하루에 정확히 한 번 있어야 합니다.`,
        });
      }
    }
  });
}

/** 1단계 골격 검증(7일 날짜/끼니/옵션 type 강제). */
export function buildWeeklySkeletonResponseSchema(
  weekStartDate: string,
  selectedSlots: readonly (typeof MEAL_SLOTS)[number][],
) {
  const expectedDates = buildWeekDates(weekStartDate).map((entry) => entry.date);
  const expectedDayLabels = buildWeekDates(weekStartDate).map(
    (entry) => entry.dayLabel,
  );
  const slotSet = new Set(selectedSlots);

  return weeklySkeletonSchema.superRefine((weekly, ctx) => {
    if (weekly.weekStartDate !== weekStartDate) {
      ctx.addIssue({
        code: "custom",
        message: `weekStartDate는 ${weekStartDate} 이어야 합니다.`,
      });
    }

    weekly.dailyPlans.forEach((day, index) => {
      if (day.date !== expectedDates[index]) {
        ctx.addIssue({
          code: "custom",
          message: `dailyPlans[${index}].date는 ${expectedDates[index]} 이어야 합니다.`,
        });
      }
      if (day.dayLabel !== expectedDayLabels[index]) {
        ctx.addIssue({
          code: "custom",
          message: `dailyPlans[${index}].dayLabel은 ${expectedDayLabels[index]} 이어야 합니다.`,
        });
      }

      const mealTypes = day.meals.map((meal) => meal.mealType);
      for (const mealType of mealTypes) {
        if (!slotSet.has(mealType)) {
          ctx.addIssue({
            code: "custom",
            message: `선택하지 않은 끼니(${mealType})가 포함됐습니다.`,
          });
        }
      }
      for (const slot of selectedSlots) {
        if (mealTypes.filter((type) => type === slot).length !== 1) {
          ctx.addIssue({
            code: "custom",
            message: `끼니 ${slot}은 하루에 정확히 한 번 있어야 합니다.`,
          });
        }
      }
    });
  });
}

/** 2단계 상세 검증(골격의 date/day/meal/option/영양수치 고정). */
export function buildDetailedDayFromSkeletonResponseSchema(
  skeletonDay: DailySkeleton,
  selectedSlots: readonly (typeof MEAL_SLOTS)[number][],
  options?: { fridgeOnly?: boolean },
) {
  const base = buildSingleDayPlanResponseSchema(
    skeletonDay.date,
    skeletonDay.dayLabel,
    selectedSlots,
  );
  const fridgeOnly = options?.fridgeOnly ?? false;

  return base.superRefine((day, ctx) => {
    for (const skeletonMeal of skeletonDay.meals) {
      const actualMeal = day.meals.find(
        (meal) => meal.mealType === skeletonMeal.mealType,
      );
      if (!actualMeal) {
        ctx.addIssue({
          code: "custom",
          message: `끼니 ${skeletonMeal.mealType}가 누락됐습니다.`,
        });
        continue;
      }

      for (const skeletonOption of skeletonMeal.options) {
        const actualOption = actualMeal.options.find(
          (option) => option.type === skeletonOption.type,
        );
        if (!actualOption) {
          ctx.addIssue({
            code: "custom",
            message: `옵션 ${skeletonOption.type}가 누락됐습니다.`,
          });
          continue;
        }

        if (actualOption.title !== skeletonOption.title) {
          ctx.addIssue({
            code: "custom",
            message: `옵션 ${skeletonOption.type} title은 골격과 동일해야 합니다.`,
          });
        }
        if (actualOption.estimatedCalories !== skeletonOption.estimatedCalories) {
          ctx.addIssue({
            code: "custom",
            message: `옵션 ${skeletonOption.type} estimatedCalories는 골격과 동일해야 합니다.`,
          });
        }
        if (actualOption.estimatedProteinG !== skeletonOption.estimatedProteinG) {
          ctx.addIssue({
            code: "custom",
            message: `옵션 ${skeletonOption.type} estimatedProteinG는 골격과 동일해야 합니다.`,
          });
        }
        if (actualOption.prepMinutes !== skeletonOption.prepMinutes) {
          ctx.addIssue({
            code: "custom",
            message: `옵션 ${skeletonOption.type} prepMinutes는 골격과 동일해야 합니다.`,
          });
        }

        if (fridgeOnly) {
          const hasNonFridge = actualOption.ingredients.some(
            (ingredient) => !ingredient.fromFridge,
          );
          if (hasNonFridge) {
            ctx.addIssue({
              code: "custom",
              message: `냉장고 전용 모드에서는 옵션 ${skeletonOption.type} 재료가 모두 fromFridge=true 여야 합니다.`,
            });
          }
        }
      }
    }
  });
}

const shoppingSuggestionSchema = z.object({
  name: z.string().min(1).max(40),
  reason: z.string().max(100),
  priority: z.enum(["optional", "recommended"]),
});

export const weekMetaResponseSchema = z.object({
  shoppingSuggestions: z.array(shoppingSuggestionSchema).max(10),
  safetyNote: z.string().max(300),
});

const unmanagedMealCaloriesSchema = z.object({
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
  note: z.string().max(200),
});

export const STREAM_FORMAT_ERROR =
  "생성된 식단 형식이 올바르지 않아요. 다시 시도해 주세요.";

const weeklyPlanStartEventSchema = z.object({
  type: z.literal("start"),
  weekStartDate: z.string(),
  totalDays: z.number().int().positive(),
  unmanagedMealCalories: unmanagedMealCaloriesSchema,
});

const weeklyPlanProgressEventSchema = z.object({
  type: z.literal("progress"),
  dayIndex: z.number().int().nonnegative(),
  totalDays: z.number().int().positive(),
  dayLabel: z.string(),
  date: z.string(),
});

const weeklyPlanDayEventSchema = z.object({
  type: z.literal("day"),
  dayIndex: z.number().int().min(0).max(6),
  dailyPlan: z.unknown(),
});

const weeklyPlanMetaEventSchema = z.object({
  type: z.literal("meta"),
  shoppingSuggestions: z.array(shoppingSuggestionSchema),
  safetyNote: z.string(),
});

const weeklyPlanPartialEventSchema = z.object({
  type: z.literal("partial"),
  completedDays: z.number().int().nonnegative(),
  totalDays: z.number().int().positive(),
  plan: z.unknown(),
});

const weeklyPlanDoneEventSchema = z.object({
  type: z.literal("done"),
  plan: z.unknown(),
});

const weeklyPlanErrorEventSchema = z.object({
  type: z.literal("error"),
  message: z.string(),
  code: z.string().optional(),
});

const weeklyPlanStreamEventSchema = z.discriminatedUnion("type", [
  weeklyPlanStartEventSchema,
  weeklyPlanProgressEventSchema,
  weeklyPlanDayEventSchema,
  weeklyPlanMetaEventSchema,
  weeklyPlanPartialEventSchema,
  weeklyPlanDoneEventSchema,
  weeklyPlanErrorEventSchema,
]);

export type ParsedWeeklyPlanStreamEvent = z.infer<
  typeof weeklyPlanStreamEventSchema
>;

/** NDJSON 한 줄을 런타임 검증한다. */
export function parseWeeklyPlanStreamEvent(raw: unknown): ParsedWeeklyPlanStreamEvent {
  const parsed = weeklyPlanStreamEventSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(
      "[useWeeklyPlan] stream_event_invalid",
      JSON.stringify(parsed.error.issues.slice(0, 10)),
    );
    throw new Error(STREAM_FORMAT_ERROR);
  }
  return parsed.data;
}

/**
 * weekStartDate와 selectedMealSlots에 맞춰 응답을 엄격히 검증한다.
 * - dailyPlans 정확히 7개 + weekStartDate부터 연속된 날짜
 * - 각 날짜의 meals는 선택한 끼니만, 각 끼니 정확히 1번
 */
export function buildWeeklyPlanResponseSchema(
  weekStartDate: string,
  selectedSlots: readonly (typeof MEAL_SLOTS)[number][],
  options?: { fridgeOnly?: boolean },
) {
  const expectedDates = buildWeekDates(weekStartDate).map((entry) => entry.date);
  const slotSet = new Set(selectedSlots);
  const fridgeOnly = options?.fridgeOnly ?? false;

  return z.object({
    weekStartDate: z.string().regex(YMD),
    dailyPlans: z
      .array(dailyPlanSchema)
      .length(7)
      .superRefine((days, ctx) => {
        days.forEach((day, index) => {
          if (day.date !== expectedDates[index]) {
            ctx.addIssue({
              code: "custom",
              message: `dailyPlans[${index}].date는 ${expectedDates[index]} 이어야 합니다.`,
            });
          }

          const mealTypes = day.meals.map((meal) => meal.mealType);

          for (const mealType of mealTypes) {
            if (!slotSet.has(mealType)) {
              ctx.addIssue({
                code: "custom",
                message: `선택하지 않은 끼니(${mealType})가 포함됐습니다.`,
              });
            }
          }

          for (const slot of selectedSlots) {
            if (mealTypes.filter((type) => type === slot).length !== 1) {
              ctx.addIssue({
                code: "custom",
                message: `끼니 ${slot}은 하루에 정확히 한 번 있어야 합니다.`,
              });
            }
          }

          if (fridgeOnly) {
            for (const meal of day.meals) {
              for (const option of meal.options) {
                const hasNonFridge = option.ingredients.some(
                  (ingredient) => !ingredient.fromFridge,
                );
                if (hasNonFridge) {
                  ctx.addIssue({
                    code: "custom",
                    message: `냉장고 전용 모드에서는 ${day.date}/${meal.mealType}/${option.type} 재료가 모두 fromFridge=true 여야 합니다.`,
                  });
                }
              }
            }
          }
        });
      }),
    shoppingSuggestions: z.array(shoppingSuggestionSchema).max(20),
    unmanagedMealCalories: unmanagedMealCaloriesSchema,
    safetyNote: z.string().max(300),
  });
}

export type WeeklyPlanResponseSchema = ReturnType<
  typeof buildWeeklyPlanResponseSchema
>;
