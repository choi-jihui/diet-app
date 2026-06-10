import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamObject } from "ai";
import {
  computeSlotBudgets,
  computeUnmanagedRange,
} from "@/lib/ai/calorie-allocation";
import { getGeminiModel } from "@/lib/ai/model";
import {
  buildWeeklyPlanUserPrompt,
  WEEKLY_PLAN_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import {
  buildWeeklyPlanResponseSchema,
  type GenerateWeeklyPlanRequest,
} from "@/lib/ai/schemas";
import { weeklyMealPlanObjectSchema } from "@/lib/ai/weekly-plan-object-schema";
import { buildWeekDates } from "@/lib/utils/date";
import type { WeeklyMealPlan } from "@/types/meal";
import type { MealSlot } from "@/types/user";

function getGoogleProvider() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("missing_gemini_key");
  }
  return createGoogleGenerativeAI({ apiKey });
}

export type WeeklyPlanStreamEvent =
  | {
      type: "start";
      weekStartDate: string;
      totalDays: number;
      unmanagedMealCalories: WeeklyMealPlan["unmanagedMealCalories"];
    }
  | {
      type: "partial";
      completedDays: number;
      totalDays: number;
      plan: WeeklyMealPlan;
    }
  | { type: "done"; plan: WeeklyMealPlan }
  | { type: "error"; code: string; message: string };

function countCompletedDays(
  dailyPlans: WeeklyMealPlan["dailyPlans"] | undefined,
): number {
  if (!dailyPlans) {
    return 0;
  }
  return dailyPlans.filter((day) => day?.meals?.length > 0).length;
}

function applyAuthoritativeFields(
  plan: WeeklyMealPlan,
  request: GenerateWeeklyPlanRequest,
  selectedSlots: MealSlot[],
): WeeklyMealPlan {
  const unmanaged = computeUnmanagedRange(
    request.nutritionTargets.targetCalories,
    selectedSlots,
  );
  const budgetBySlot = new Map(
    computeSlotBudgets(
      request.nutritionTargets.targetCalories,
      selectedSlots,
    ).map((entry) => [entry.slot, entry.budget]),
  );

  return {
    ...plan,
    weekStartDate: request.weekStartDate,
    unmanagedMealCalories: unmanaged,
    dailyPlans: plan.dailyPlans.map((day) => ({
      ...day,
      meals: day.meals.map((meal) => ({
        ...meal,
        targetCalories: budgetBySlot.get(meal.mealType) ?? meal.targetCalories,
      })),
    })),
  };
}

function toDisplayPlan(
  partial: Partial<WeeklyMealPlan>,
  request: GenerateWeeklyPlanRequest,
  selectedSlots: MealSlot[],
): WeeklyMealPlan {
  const unmanaged = computeUnmanagedRange(
    request.nutritionTargets.targetCalories,
    selectedSlots,
  );

  return {
    weekStartDate: partial.weekStartDate ?? request.weekStartDate,
    dailyPlans: (partial.dailyPlans ?? []).filter(Boolean) as WeeklyMealPlan["dailyPlans"],
    shoppingSuggestions: partial.shoppingSuggestions ?? [],
    unmanagedMealCalories: partial.unmanagedMealCalories ?? unmanaged,
    safetyNote: partial.safetyNote ?? "",
  };
}

async function generateOnce(
  request: GenerateWeeklyPlanRequest,
  selectedSlots: MealSlot[],
  retryHint?: string,
) {
  const slotBudgets = computeSlotBudgets(
    request.nutritionTargets.targetCalories,
    selectedSlots,
  );
  const weekDates = buildWeekDates(request.weekStartDate);
  const unmanaged = computeUnmanagedRange(
    request.nutritionTargets.targetCalories,
    selectedSlots,
  );

  const prompt =
    buildWeeklyPlanUserPrompt({
      request,
      slotBudgets,
      weekDates,
      unmanaged,
    }) + (retryHint ? `\n\n이전 응답 오류:\n${retryHint}` : "");

  return streamObject({
    model: getGoogleProvider()(getGeminiModel()),
    schema: weeklyMealPlanObjectSchema,
    system: WEEKLY_PLAN_SYSTEM_PROMPT,
    prompt,
    temperature: 0.1,
    maxOutputTokens: 16384,
  });
}

/** 단일 Gemini 호출 + streamObject로 7일 식단을 실시간 스트리밍한다. */
export async function* streamWeeklyPlanSingleCall(
  request: GenerateWeeklyPlanRequest,
  selectedSlots: MealSlot[],
): AsyncGenerator<WeeklyPlanStreamEvent> {
  const totalDays = 7;
  const unmanaged = computeUnmanagedRange(
    request.nutritionTargets.targetCalories,
    selectedSlots,
  );

  yield {
    type: "start",
    weekStartDate: request.weekStartDate,
    totalDays,
    unmanagedMealCalories: unmanaged,
  };

  const responseSchema = buildWeeklyPlanResponseSchema(
    request.weekStartDate,
    selectedSlots,
  );

  let retryHint: string | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await generateOnce(request, selectedSlots, retryHint);

      for await (const partial of result.partialObjectStream) {
        const display = toDisplayPlan(
          partial as Partial<WeeklyMealPlan>,
          request,
          selectedSlots,
        );
        yield {
          type: "partial",
          completedDays: countCompletedDays(display.dailyPlans),
          totalDays,
          plan: display,
        };
      }

      const raw = await result.object;
      const validated = responseSchema.safeParse(raw);

      if (!validated.success) {
        const issues = validated.error.issues
          .slice(0, 8)
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ");
        console.error(
          `[generate-weekly-plan] schema_invalid attempt=${attempt}`,
          issues,
        );
        retryHint = issues;
        continue;
      }

      const authoritative = applyAuthoritativeFields(
        validated.data as WeeklyMealPlan,
        request,
        selectedSlots,
      );

      yield { type: "done", plan: authoritative };
      return;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "unknown";
      console.error(
        `[generate-weekly-plan] stream_error attempt=${attempt}`,
        message.slice(0, 200),
      );
      retryHint = "JSON 구조를 스키마에 맞게 다시 생성하세요.";
    }
  }

  yield {
    type: "error",
    code: "INVALID_OUTPUT",
    message: "식단을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
  };
}
