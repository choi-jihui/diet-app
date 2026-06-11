import {
  computeSlotBudgets,
  computeUnmanagedRange,
} from "@/lib/ai/calorie-allocation";
import { GeminiError, generateJsonContent } from "@/lib/ai/gemini";
import {
  buildSingleDayPlanPrompt,
  buildWeekMetaPrompt,
  WEEKLY_PLAN_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import {
  buildSingleDayPlanResponseSchema,
  type GenerateWeeklyPlanRequest,
  weekMetaResponseSchema,
} from "@/lib/ai/schemas";
import { buildWeekDates } from "@/lib/utils/date";
import type { DailyPlan, WeeklyMealPlan } from "@/types/meal";
import type { MealSlot } from "@/types/user";

const DAY_MAX_TOKENS = 6144;
const META_MAX_TOKENS = 2048;
const DAY_TIMEOUT_MS = 60_000;
const META_TIMEOUT_MS = 30_000;

async function generateSingleDay(
  request: GenerateWeeklyPlanRequest,
  slotBudgets: ReturnType<typeof computeSlotBudgets>,
  dayDate: string,
  dayLabel: string,
  dayIndex: number,
  selectedSlots: MealSlot[],
): Promise<DailyPlan | null> {
  const schema = buildSingleDayPlanResponseSchema(
    dayDate,
    dayLabel,
    selectedSlots,
  );
  const prompt = buildSingleDayPlanPrompt({
    request,
    slotBudgets,
    dayDate,
    dayLabel,
    dayIndex,
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await generateJsonContent({
        system: WEEKLY_PLAN_SYSTEM_PROMPT,
        user: prompt,
        maxOutputTokens: DAY_MAX_TOKENS,
        timeoutMs: DAY_TIMEOUT_MS,
      });
      const validated = schema.safeParse(raw);
      if (validated.success) {
        return validated.data;
      }
      console.error(
        "[generate-weekly-plan] day_schema_invalid",
        dayDate,
        `attempt=${attempt}`,
        JSON.stringify(validated.error.issues.slice(0, 10)),
      );
    } catch (caught) {
      const code = caught instanceof GeminiError ? caught.code : "unknown";
      console.error(
        `[generate-weekly-plan] day_gemini_error ${dayDate} attempt=${attempt} code=${code}`,
      );
    }
  }

  return null;
}

async function generateWeekMeta(
  request: GenerateWeeklyPlanRequest,
  dayTitles: string[],
): Promise<{ shoppingSuggestions: WeeklyMealPlan["shoppingSuggestions"]; safetyNote: string } | null> {
  const prompt = buildWeekMetaPrompt({ request, dayTitles });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await generateJsonContent({
        system: WEEKLY_PLAN_SYSTEM_PROMPT,
        user: prompt,
        maxOutputTokens: META_MAX_TOKENS,
        timeoutMs: META_TIMEOUT_MS,
      });
      const validated = weekMetaResponseSchema.safeParse(raw);
      if (validated.success) {
        return validated.data;
      }
      console.error(
        `[generate-weekly-plan] meta_schema_invalid attempt=${attempt}`,
      );
    } catch (caught) {
      const code = caught instanceof GeminiError ? caught.code : "unknown";
      console.error(
        `[generate-weekly-plan] meta_gemini_error attempt=${attempt} code=${code}`,
      );
    }
  }

  return null;
}

/** 7일을 하루 단위로 병렬 생성해 속도와 JSON 안정성을 높인다. */
export async function generateWeeklyMealPlan(
  request: GenerateWeeklyPlanRequest,
  selectedSlots: MealSlot[],
): Promise<WeeklyMealPlan | null> {
  const slotBudgets = computeSlotBudgets(
    request.nutritionTargets.targetCalories,
    selectedSlots,
  );
  const unmanaged = computeUnmanagedRange(
    request.nutritionTargets.targetCalories,
    selectedSlots,
  );
  const weekDates = buildWeekDates(request.weekStartDate);
  const budgetBySlot = new Map(
    slotBudgets.map((entry) => [entry.slot, entry.budget]),
  );

  // 병렬 7회는 JSON 오류·레이트리밋을 유발할 수 있어 순차 생성한다.
  const dayResults: DailyPlan[] = [];
  for (let index = 0; index < weekDates.length; index += 1) {
    const entry = weekDates[index];
    const day = await generateSingleDay(
      request,
      slotBudgets,
      entry.date,
      entry.dayLabel,
      index,
      selectedSlots,
    );
    if (!day) {
      return null;
    }
    dayResults.push(day);
  }

  const dailyPlans = dayResults.map((day) => ({
    ...day,
    meals: day.meals.map((meal) => ({
      ...meal,
      targetCalories: budgetBySlot.get(meal.mealType) ?? meal.targetCalories,
    })),
  }));

  const dayTitles = dailyPlans.flatMap((day) =>
    day.meals.flatMap((meal) => meal.options.map((option) => option.title)),
  );

  const meta = await generateWeekMeta(request, dayTitles);
  if (!meta) {
    return null;
  }

  return {
    weekStartDate: request.weekStartDate,
    dailyPlans,
    shoppingSuggestions: meta.shoppingSuggestions,
    unmanagedMealCalories: unmanaged,
    safetyNote: meta.safetyNote,
  };
}
