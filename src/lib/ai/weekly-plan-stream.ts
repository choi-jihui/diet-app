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

export type WeeklyPlanStreamEvent =
  | {
      type: "start";
      weekStartDate: string;
      totalDays: number;
      unmanagedMealCalories: WeeklyMealPlan["unmanagedMealCalories"];
    }
  | {
      type: "progress";
      dayIndex: number;
      totalDays: number;
      dayLabel: string;
      date: string;
    }
  | { type: "day"; dayIndex: number; dailyPlan: DailyPlan }
  | {
      type: "meta";
      shoppingSuggestions: WeeklyMealPlan["shoppingSuggestions"];
      safetyNote: string;
    }
  | { type: "done"; plan: WeeklyMealPlan }
  | { type: "error"; message: string };

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

/** 하루씩 생성하며 이벤트를보낸다. 클라이언트에서 실시간 UI에 사용한다. */
export async function* streamWeeklyMealPlan(
  request: GenerateWeeklyPlanRequest,
  selectedSlots: MealSlot[],
): AsyncGenerator<WeeklyPlanStreamEvent> {
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

  yield {
    type: "start",
    weekStartDate: request.weekStartDate,
    totalDays: weekDates.length,
    unmanagedMealCalories: unmanaged,
  };

  const dailyPlans: DailyPlan[] = [];

  for (let index = 0; index < weekDates.length; index += 1) {
    const entry = weekDates[index];

    yield {
      type: "progress",
      dayIndex: index,
      totalDays: weekDates.length,
      dayLabel: entry.dayLabel,
      date: entry.date,
    };

    const day = await generateSingleDay(
      request,
      slotBudgets,
      entry.date,
      entry.dayLabel,
      index,
      selectedSlots,
    );

    if (!day) {
      yield {
        type: "error",
        message: "식단을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
      };
      return;
    }

    const normalized: DailyPlan = {
      ...day,
      meals: day.meals.map((meal) => ({
        ...meal,
        targetCalories: budgetBySlot.get(meal.mealType) ?? meal.targetCalories,
      })),
    };

    dailyPlans.push(normalized);
    yield { type: "day", dayIndex: index, dailyPlan: normalized };
  }

  const dayTitles = dailyPlans.flatMap((day) =>
    day.meals.flatMap((meal) => meal.options.map((option) => option.title)),
  );

  yield {
    type: "progress",
    dayIndex: weekDates.length,
    totalDays: weekDates.length,
    dayLabel: "장보기",
    date: request.weekStartDate,
  };

  const meta = await generateWeekMeta(request, dayTitles);
  if (!meta) {
    yield {
      type: "error",
      message: "식단을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
    };
    return;
  }

  yield {
    type: "meta",
    shoppingSuggestions: meta.shoppingSuggestions,
    safetyNote: meta.safetyNote,
  };

  const plan: WeeklyMealPlan = {
    weekStartDate: request.weekStartDate,
    dailyPlans,
    shoppingSuggestions: meta.shoppingSuggestions,
    unmanagedMealCalories: unmanaged,
    safetyNote: meta.safetyNote,
  };

  yield { type: "done", plan };
}
