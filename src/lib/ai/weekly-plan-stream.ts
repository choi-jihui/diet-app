import {
  computeSlotBudgets,
  computeUnmanagedRange,
} from "@/lib/ai/calorie-allocation";
import { GeminiError, generateJsonContent } from "@/lib/ai/gemini";
import {
  buildAllowedIngredientKeys,
  buildPantryIngredientKeys,
  validateFridgeOnlyDayPlan,
} from "@/lib/ai/fridge-only";
import { getGeminiModel, getWeeklyGeminiModel } from "@/lib/ai/model";
import {
  buildSingleDayPlanPrompt,
  WEEKLY_PLAN_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import {
  buildSingleDayPlanResponseSchema,
  buildWeeklyPlanResponseSchema,
  type GenerateWeeklyPlanRequest,
} from "@/lib/ai/schemas";
import { WEEKLY_DAY_RESPONSE_JSON_SCHEMA } from "@/lib/ai/weekly-plan-json-schema";
import { buildWeekDates } from "@/lib/utils/date";
import type { DailyPlan, WeeklyMealPlan } from "@/types/meal";
import type { MealSlot } from "@/types/user";

const DAY_TIMEOUT_MS = 60_000;
const DAY_CONCURRENCY = 2;
const SAFETY_NOTE =
  "칼로리와 단백질은 추정치이며, 보유 재료의 실제 양에 따라 조절해 주세요.";

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
  | { type: "error"; message: string; code?: string };

type DayFailureCode =
  | "gemini_http_error"
  | "gemini_timeout"
  | "gemini_invalid_json"
  | "day_schema_invalid"
  | "fridge_only_violation"
  | "unknown";

function getDayMaxTokens(selectedSlotCount: number): number {
  if (selectedSlotCount <= 1) {
    return 2200;
  }
  if (selectedSlotCount === 2) {
    return 4000;
  }
  return 5600;
}

function getModelCandidates(): string[] {
  const weekly = getWeeklyGeminiModel().trim();
  const common = getGeminiModel().trim();
  return Array.from(new Set([weekly, common, "gemini-2.5-flash"].filter(Boolean)));
}

function mapGeminiErrorCode(code: GeminiError["code"]): DayFailureCode {
  switch (code) {
    case "http_error":
      return "gemini_http_error";
    case "timeout":
      return "gemini_timeout";
    case "invalid_json":
      return "gemini_invalid_json";
    default:
      return "unknown";
  }
}

function buildDayRepairPrompt(input: {
  basePrompt: string;
  unknownIngredients: string[];
  reason: string;
}) {
  const unknown =
    input.unknownIngredients.length > 0
      ? input.unknownIngredients.slice(0, 8).join(", ")
      : "없음";
  return `${input.basePrompt}

추가 수정 지시:
- 허용되지 않은 재료를 제거하고 제공된 목록으로만 다시 작성하세요.
- 허용되지 않은 재료: ${unknown}
- 실패 사유: ${input.reason}
- 냉장고 재료 외 신규 주재료/구매 제안/대체 재료 금지
- fromFridge=false는 기본 조리요소(물, 소금, 후추, 식용유)만 허용`;
}

async function generateSingleDay(
  request: GenerateWeeklyPlanRequest,
  slotBudgets: ReturnType<typeof computeSlotBudgets>,
  dayDate: string,
  dayLabel: string,
  dayIndex: number,
  selectedSlots: MealSlot[],
  allowedFridgeKeys: Set<string>,
  pantryKeys: Set<string>,
): Promise<{ day: DailyPlan | null; errorCode: DayFailureCode }> {
  const schema = buildSingleDayPlanResponseSchema(
    dayDate,
    dayLabel,
    selectedSlots,
  );
  const basePrompt = buildSingleDayPlanPrompt({
    request,
    slotBudgets,
    dayDate,
    dayLabel,
    dayIndex,
  });
  const dayStartedAt = Date.now();
  const dayBaseMaxTokens = getDayMaxTokens(selectedSlots.length);
  const modelCandidates = getModelCandidates();
  let repairUnknownIngredients: string[] = [];
  let lastFailureCode: DayFailureCode = "unknown";
  let lastGeminiCode: GeminiError["code"] | null = null;

  for (const model of modelCandidates) {
    lastGeminiCode = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const prompt =
        attempt === 0
          ? basePrompt
          : buildDayRepairPrompt({
              basePrompt,
              unknownIngredients: repairUnknownIngredients,
              reason: lastFailureCode,
            });

      // Retry 시 토큰을 늘려 MAX_TOKENS를 완화한다.
      const dayMaxTokens =
        attempt === 0
          ? dayBaseMaxTokens
          : Math.min(8192, dayBaseMaxTokens + 1800);

      try {
        const raw = await generateJsonContent({
          system: WEEKLY_PLAN_SYSTEM_PROMPT,
          user: prompt,
          model,
          maxOutputTokens: dayMaxTokens,
          timeoutMs: DAY_TIMEOUT_MS,
          responseJsonSchema: WEEKLY_DAY_RESPONSE_JSON_SCHEMA,
        });
        const validated = schema.safeParse(raw);
        if (validated.success) {
          const fridgeValidation = validateFridgeOnlyDayPlan(
            validated.data,
            allowedFridgeKeys,
            pantryKeys,
          );
          if (fridgeValidation.isValid) {
            const elapsedMs = Date.now() - dayStartedAt;
            console.info(
              `[generate-weekly-plan] DAY_GENERATION_SUCCESS dayIndex=${dayIndex} elapsedMs=${elapsedMs} model=${model}`,
            );
            return { day: validated.data, errorCode: "unknown" };
          }

          lastFailureCode = "fridge_only_violation";
          repairUnknownIngredients = fridgeValidation.unknownIngredients;
          console.error(
            `[generate-weekly-plan] DAY_GENERATION_FAILURE dayIndex=${dayIndex} errorCode=fridge_only_violation`,
          );
          continue;
        }

        lastFailureCode = "day_schema_invalid";
        console.error(
          `[generate-weekly-plan] DAY_GENERATION_FAILURE dayIndex=${dayIndex} errorCode=day_schema_invalid`,
        );
      } catch (caught) {
        const code = caught instanceof GeminiError ? caught.code : "unknown";
        if (caught instanceof GeminiError) {
          lastGeminiCode = caught.code;
        }
        lastFailureCode =
          caught instanceof GeminiError ? mapGeminiErrorCode(caught.code) : "unknown";
        console.error(
          `[generate-weekly-plan] DAY_GENERATION_FAILURE dayIndex=${dayIndex} errorCode=${code}`,
        );
      }
    }

    // 400류/스키마 실패인 경우 동일 모델 재시도 효과가 낮아 다음 모델로 넘어간다.
    if (lastGeminiCode === "http_error" || lastFailureCode === "day_schema_invalid") {
      continue;
    }
  }

  return { day: null, errorCode: lastFailureCode };
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
  const allowedFridgeKeys = buildAllowedIngredientKeys(request.ingredients);
  const pantryKeys = buildPantryIngredientKeys();

  yield {
    type: "start",
    weekStartDate: request.weekStartDate,
    totalDays: weekDates.length,
    unmanagedMealCalories: unmanaged,
  };

  if (weekDates[0]) {
    yield {
      type: "progress",
      dayIndex: 0,
      totalDays: weekDates.length,
      dayLabel: weekDates[0].dayLabel,
      date: weekDates[0].date,
    };
  }

  const completedByIndex: Array<DailyPlan | null> = Array.from(
    { length: weekDates.length },
    () => null,
  );
  const active = new Map<
    number,
    Promise<{
      dayIndex: number;
      day: DailyPlan | null;
      errorCode: DayFailureCode;
    }>
  >();
  let nextDayIndex = 0;
  let completedCount = 0;

  const startTask = (dayIndex: number) => {
    const entry = weekDates[dayIndex];
    if (!entry) {
      return;
    }
    const task = generateSingleDay(
      request,
      slotBudgets,
      entry.date,
      entry.dayLabel,
      dayIndex,
      selectedSlots,
      allowedFridgeKeys,
      pantryKeys,
    ).then((result) => ({
      dayIndex,
      day: result.day,
      errorCode: result.errorCode,
    }));
    active.set(dayIndex, task);
  };

  while (active.size < DAY_CONCURRENCY && nextDayIndex < weekDates.length) {
    startTask(nextDayIndex);
    nextDayIndex += 1;
  }

  while (active.size > 0) {
    const settled = await Promise.race(active.values());
    active.delete(settled.dayIndex);

    if (!settled.day) {
      yield {
        type: "error",
        code: settled.errorCode,
        message: "식단을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
      };
      return;
    }

    const normalized: DailyPlan = {
      ...settled.day,
      meals: settled.day.meals.map((meal) => ({
        ...meal,
        targetCalories: budgetBySlot.get(meal.mealType) ?? meal.targetCalories,
      })),
    };
    completedByIndex[settled.dayIndex] = normalized;
    completedCount += 1;
    yield { type: "day", dayIndex: settled.dayIndex, dailyPlan: normalized };

    if (completedCount < weekDates.length) {
      const remaining = weekDates.find(
        (_, index) => completedByIndex[index] == null,
      );
      if (remaining) {
        yield {
          type: "progress",
          dayIndex: completedCount,
          totalDays: weekDates.length,
          dayLabel: remaining.dayLabel,
          date: remaining.date,
        };
      }
    }

    while (active.size < DAY_CONCURRENCY && nextDayIndex < weekDates.length) {
      startTask(nextDayIndex);
      nextDayIndex += 1;
    }
  }

  if (completedByIndex.some((day) => day == null)) {
    yield {
      type: "error",
      code: "incomplete_days",
      message: "식단을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
    };
    return;
  }

  const dailyPlans = completedByIndex as DailyPlan[];

  yield {
    type: "progress",
    dayIndex: weekDates.length,
    totalDays: weekDates.length,
    dayLabel: "장보기",
    date: request.weekStartDate,
  };

  yield {
    type: "meta",
    shoppingSuggestions: [],
    safetyNote: SAFETY_NOTE,
  };

  const plan: WeeklyMealPlan = {
    weekStartDate: request.weekStartDate,
    dailyPlans,
    shoppingSuggestions: [],
    unmanagedMealCalories: unmanaged,
    safetyNote: SAFETY_NOTE,
  };

  const finalSchema = buildWeeklyPlanResponseSchema(
    request.weekStartDate,
    selectedSlots,
    { fridgeOnly: true },
  );
  const validated = finalSchema.safeParse(plan);
  if (!validated.success) {
    yield {
      type: "error",
      code: "final_schema_invalid",
      message: "식단을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
    };
    return;
  }

  yield { type: "done", plan };
}
