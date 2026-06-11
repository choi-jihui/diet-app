import {
  computeSlotBudgets,
  computeUnmanagedRange,
} from "@/lib/ai/calorie-allocation";
import { GeminiError, generateJsonContentWithMeta } from "@/lib/ai/gemini";
import { getGeminiModel, getWeeklyGeminiModel } from "@/lib/ai/model";
import {
  buildDayDetailFromSkeletonPrompt,
  buildWeeklySkeletonPrompt,
  WEEKLY_PLAN_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import {
  buildDetailedDayFromSkeletonResponseSchema,
  buildWeeklySkeletonResponseSchema,
  buildWeeklyPlanResponseSchema,
  type DailySkeleton,
  type GenerateWeeklyPlanRequest,
  type WeeklySkeleton,
} from "@/lib/ai/schemas";
import { buildWeekDates } from "@/lib/utils/date";
import type { WeeklyMealPlan } from "@/types/meal";
import type { MealSlot } from "@/types/user";
import { z } from "zod";

const TOTAL_DAYS = 7;
const SKELETON_MAX_TOKENS = 8192;
const SKELETON_TIMEOUT_MS = 45_000;
const DAY_TIMEOUT_MS = 45_000;
const DAY_CONCURRENCY = 2;
const SAFETY_NOTE =
  "칼로리와 단백질은 추정치예요. 실제 섭취량과 컨디션에 맞게 조절해 주세요.";
const RECOMMENDED_REASON = "이번 주 여러 식단에 활용할 수 있어요.";
const OPTIONAL_REASON = "한두 끼의 선택지를 넓히는 데 좋아요.";
const RETRY_BACKOFF_MIN_MS = 500;
const RETRY_BACKOFF_MAX_MS = 1000;

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
  | {
      type: "progress";
      dayIndex: number;
      totalDays: number;
      dayLabel: string;
      date: string;
    }
  | { type: "day"; dayIndex: number; dailyPlan: WeeklyMealPlan["dailyPlans"][number] }
  | {
      type: "meta";
      shoppingSuggestions: WeeklyMealPlan["shoppingSuggestions"];
      safetyNote: string;
    }
  | { type: "done"; plan: WeeklyMealPlan }
  | { type: "error"; code: string; message: string };

interface StreamMetrics {
  geminiCalls: number;
  retries: number;
  rawPartialCount: number;
  sentPartialCount: number;
  skeletonDurationMs: number;
  firstCompletedDayDurationMs: number | null;
}

function getDayMaxTokens(selectedSlotCount: number): number {
  if (selectedSlotCount <= 1) {
    return 2400;
  }
  if (selectedSlotCount === 2) {
    return 3800;
  }
  return 5500;
}

function getModelFallbackChain(): string[] {
  const primary = getWeeklyGeminiModel().trim();
  const fallback = getGeminiModel().trim();
  const models = [primary, fallback, "gemini-2.5-flash"];
  return Array.from(new Set(models.filter(Boolean)));
}

function toIssuesSummary(
  issues: Array<{ path: PropertyKey[]; message: string }>,
) {
  return issues
    .slice(0, 8)
    .map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`)
    .join("; ");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sleepBackoff() {
  const delta = RETRY_BACKOFF_MAX_MS - RETRY_BACKOFF_MIN_MS;
  const waitMs = RETRY_BACKOFF_MIN_MS + Math.floor(Math.random() * (delta + 1));
  await sleep(waitMs);
}

function isRetryableHttpStatus(statusCode: number | undefined): boolean {
  if (!statusCode) {
    return false;
  }
  return statusCode === 429 || statusCode >= 500;
}

function classifyRetry(
  caught: unknown,
): "retry" | "repair" | "fatal" {
  if (!(caught instanceof GeminiError)) {
    return "retry";
  }

  if (caught.code === "missing_key") {
    return "fatal";
  }
  if (caught.code === "invalid_json" || caught.code === "empty_response") {
    return "repair";
  }
  if (caught.code === "timeout" || caught.code === "truncated") {
    return "retry";
  }
  if (caught.code === "http_error") {
    return isRetryableHttpStatus(caught.statusCode) ? "retry" : "fatal";
  }
  return "fatal";
}

function buildSkeletonRepairPrompt(input: {
  weekStartDate: string;
  selectedSlots: MealSlot[];
  issues: string;
  previous: string;
}): string {
  return `이전 주간 골격 응답이 스키마를 충족하지 못했습니다.

오류 요약:
${input.issues || "JSON 형식 오류"}

이전 응답 일부:
${input.previous || "(없음)"}

필수 조건:
- weekStartDate는 "${input.weekStartDate}"
- dailyPlans는 정확히 7개
- meals는 선택 끼니(${input.selectedSlots.join(", ")})만, 각 1개
- options는 fat_loss/filling/lazy 각 1개
- title은 50자 이하
- JSON 외 텍스트 금지

JSON만 반환하세요.`;
}

function buildDayRepairPrompt(input: {
  skeletonDay: DailySkeleton;
  issues: string;
  previous: string;
}): string {
  return `이전 일일 상세 응답이 스키마를 충족하지 못했습니다.

오류 요약:
${input.issues || "JSON 형식 오류"}

이전 응답 일부:
${input.previous || "(없음)"}

고정 골격(JSON, 아래 값은 절대 변경 금지):
${JSON.stringify(input.skeletonDay)}

요구사항:
- ingredients 최대 4개
- steps 정확히 1~2개
- why 최대 50자
- coachNote 최대 80자
- JSON 외 텍스트 금지

JSON만 반환하세요.`;
}

function buildShoppingSuggestionsFromPlans(
  dailyPlans: WeeklyMealPlan["dailyPlans"],
): WeeklyMealPlan["shoppingSuggestions"] {
  const countByKey = new Map<string, { name: string; count: number }>();

  for (const day of dailyPlans) {
    for (const meal of day.meals) {
      for (const option of meal.options) {
        for (const ingredient of option.ingredients) {
          if (ingredient.fromFridge) {
            continue;
          }
          const name = ingredient.name.trim();
          if (!name) {
            continue;
          }
          const key = name.toLowerCase();
          const prev = countByKey.get(key);
          if (prev) {
            prev.count += 1;
          } else {
            countByKey.set(key, { name, count: 1 });
          }
        }
      }
    }
  }

  return Array.from(countByKey.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"))
    .slice(0, 8)
    .map((entry) => ({
      name: entry.name,
      priority: entry.count >= 2 ? "recommended" : "optional",
      reason: entry.count >= 2 ? RECOMMENDED_REASON : OPTIONAL_REASON,
    }));
}

async function generateWeeklySkeletonWithRetry(input: {
  request: GenerateWeeklyPlanRequest;
  selectedSlots: MealSlot[];
  weekDates: ReturnType<typeof buildWeekDates>;
  slotBudgets: ReturnType<typeof computeSlotBudgets>;
  unmanaged: WeeklyMealPlan["unmanagedMealCalories"];
  models: string[];
  metrics: StreamMetrics;
}): Promise<WeeklySkeleton | null> {
  const schema = buildWeeklySkeletonResponseSchema(
    input.request.weekStartDate,
    input.selectedSlots,
  );
  const responseSchema = z.toJSONSchema(schema);
  for (const model of input.models) {
    let repairIssues = "";
    let repairPrevious = "";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const prompt =
        attempt === 0
          ? buildWeeklySkeletonPrompt({
              request: input.request,
              slotBudgets: input.slotBudgets,
              weekDates: input.weekDates,
              unmanaged: input.unmanaged,
            })
          : buildSkeletonRepairPrompt({
              weekStartDate: input.request.weekStartDate,
              selectedSlots: input.selectedSlots,
              issues: repairIssues,
              previous: repairPrevious.slice(0, 400),
            });

      try {
        input.metrics.geminiCalls += 1;
        const result = await generateJsonContentWithMeta({
          system: WEEKLY_PLAN_SYSTEM_PROMPT,
          user: prompt,
          model,
          maxOutputTokens: SKELETON_MAX_TOKENS,
          timeoutMs: SKELETON_TIMEOUT_MS,
          responseSchema,
        });
        if (attempt > 0) {
          input.metrics.retries += 1;
        }

        const validated = schema.safeParse(result.data);
        if (validated.success) {
          input.metrics.skeletonDurationMs = result.durationMs;
          console.info(
            `[weekly-plan] skeleton completed model=${result.model} durationMs=${result.durationMs} attempt=${attempt} finishReason=${result.finishReason}`,
          );
          return validated.data;
        }

        repairIssues = toIssuesSummary(validated.error.issues);
        repairPrevious = JSON.stringify(result.data).slice(0, 1200);
        console.error(
          "[weekly-plan] skeleton schema_invalid",
          `model=${model}`,
          `attempt=${attempt}`,
          repairIssues,
        );
        if (attempt === 0) {
          continue;
        }
      } catch (caught) {
        if (attempt > 0) {
          input.metrics.retries += 1;
        }

        const retryType = classifyRetry(caught);
        const code =
          caught instanceof GeminiError ? caught.code : "unknown_error";
        const finishReason =
          caught instanceof GeminiError && caught.finishReason
            ? caught.finishReason
            : "unknown";
        const status =
          caught instanceof GeminiError && caught.statusCode
            ? caught.statusCode
            : "none";

        console.error(
          `[weekly-plan] skeleton failed model=${model} attempt=${attempt} code=${code} finishReason=${finishReason} status=${status}`,
        );

        if (attempt === 0 && retryType === "repair") {
          repairIssues = code;
          repairPrevious =
            caught instanceof GeminiError ? caught.rawSample ?? "" : "";
          continue;
        }
        if (attempt === 0 && retryType === "retry") {
          await sleepBackoff();
          continue;
        }
      }
    }
  }

  return null;
}

async function generateDayDetailWithRetry(input: {
  request: GenerateWeeklyPlanRequest;
  selectedSlots: MealSlot[];
  dayIndex: number;
  skeletonDay: DailySkeleton;
  models: string[];
  maxOutputTokens: number;
  signal: AbortSignal;
  metrics: StreamMetrics;
}): Promise<WeeklyMealPlan["dailyPlans"][number] | null> {
  const schema = buildDetailedDayFromSkeletonResponseSchema(
    input.skeletonDay,
    input.selectedSlots,
  );
  const responseSchema = z.toJSONSchema(schema);
  for (const model of input.models) {
    let repairIssues = "";
    let repairPrevious = "";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const prompt =
        attempt === 0
          ? buildDayDetailFromSkeletonPrompt({
              request: input.request,
              skeletonDay: input.skeletonDay,
              dayIndex: input.dayIndex,
            })
          : buildDayRepairPrompt({
              skeletonDay: input.skeletonDay,
              issues: repairIssues,
              previous: repairPrevious.slice(0, 400),
            });

      try {
        input.metrics.geminiCalls += 1;
        const result = await generateJsonContentWithMeta({
          system: WEEKLY_PLAN_SYSTEM_PROMPT,
          user: prompt,
          model,
          maxOutputTokens: input.maxOutputTokens,
          timeoutMs: DAY_TIMEOUT_MS,
          responseSchema,
          signal: input.signal,
        });
        if (attempt > 0) {
          input.metrics.retries += 1;
        }

        const validated = schema.safeParse(result.data);
        if (validated.success) {
          console.info(
            `[weekly-plan] day completed date=${input.skeletonDay.date} dayIndex=${input.dayIndex} model=${result.model} durationMs=${result.durationMs} attempt=${attempt} finishReason=${result.finishReason}`,
          );
          return validated.data;
        }

        repairIssues = toIssuesSummary(validated.error.issues);
        repairPrevious = JSON.stringify(result.data).slice(0, 1200);
        console.error(
          "[weekly-plan] day schema_invalid",
          `date=${input.skeletonDay.date}`,
          `dayIndex=${input.dayIndex}`,
          `model=${model}`,
          `attempt=${attempt}`,
          repairIssues,
        );
        if (attempt === 0) {
          continue;
        }
      } catch (caught) {
        if (attempt > 0) {
          input.metrics.retries += 1;
        }

        if (caught instanceof DOMException && caught.name === "AbortError") {
          return null;
        }

        const retryType = classifyRetry(caught);
        const code =
          caught instanceof GeminiError ? caught.code : "unknown_error";
        const finishReason =
          caught instanceof GeminiError && caught.finishReason
            ? caught.finishReason
            : "unknown";
        const status =
          caught instanceof GeminiError && caught.statusCode
            ? caught.statusCode
            : "none";

        console.error(
          `[weekly-plan] day failed date=${input.skeletonDay.date} dayIndex=${input.dayIndex} model=${model} attempt=${attempt} code=${code} finishReason=${finishReason} status=${status}`,
        );

        if (attempt === 0 && retryType === "repair") {
          repairIssues = code;
          repairPrevious =
            caught instanceof GeminiError ? caught.rawSample ?? "" : "";
          continue;
        }
        if (attempt === 0 && retryType === "retry") {
          await sleepBackoff();
          continue;
        }
      }
    }
  }

  return null;
}

/** 단일 Gemini 호출 + streamObject로 7일 식단을 실시간 스트리밍한다. */
export async function* streamWeeklyPlanSingleCall(
  request: GenerateWeeklyPlanRequest,
  selectedSlots: MealSlot[],
): AsyncGenerator<WeeklyPlanStreamEvent> {
  const weeklyStartedAt = Date.now();
  const totalDays = TOTAL_DAYS;
  const unmanaged = computeUnmanagedRange(
    request.nutritionTargets.targetCalories,
    selectedSlots,
  );
  const slotBudgets = computeSlotBudgets(
    request.nutritionTargets.targetCalories,
    selectedSlots,
  );
  const weekDates = buildWeekDates(request.weekStartDate);
  const budgetBySlot = new Map(
    slotBudgets.map((entry) => [entry.slot, entry.budget]),
  );
  const models = getModelFallbackChain();
  const maxOutputTokens = getDayMaxTokens(selectedSlots.length);
  const metrics: StreamMetrics = {
    geminiCalls: 0,
    retries: 0,
    rawPartialCount: 0,
    sentPartialCount: 0,
    skeletonDurationMs: 0,
    firstCompletedDayDurationMs: null,
  };

  yield {
    type: "start",
    weekStartDate: request.weekStartDate,
    totalDays,
    unmanagedMealCalories: unmanaged,
  };

  const skeleton = await generateWeeklySkeletonWithRetry({
    request,
    selectedSlots,
    weekDates,
    slotBudgets,
    unmanaged,
    models,
    metrics,
  });

  if (!skeleton) {
    yield {
      type: "error",
      code: "INVALID_OUTPUT",
      message: "식단을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
    };
    return;
  }

  if (weekDates[0]) {
    yield {
      type: "progress",
      dayIndex: 0,
      totalDays,
      dayLabel: weekDates[0].dayLabel,
      date: weekDates[0].date,
    };
  }

  const completedByIndex: Array<WeeklyMealPlan["dailyPlans"][number] | null> =
    Array.from({ length: TOTAL_DAYS }, () => null);
  const controllers = new Map<number, AbortController>();
  const active = new Map<
    number,
    Promise<{
      dayIndex: number;
      day: WeeklyMealPlan["dailyPlans"][number] | null;
    }>
  >();
  let nextDayIndex = 0;
  let completedCount = 0;
  let failed = false;

  const startTask = (dayIndex: number) => {
    const skeletonDay = skeleton.dailyPlans[dayIndex];
    if (!skeletonDay) {
      return;
    }
    const controller = new AbortController();
    controllers.set(dayIndex, controller);
    const promise = generateDayDetailWithRetry({
      request,
      selectedSlots,
      dayIndex,
      skeletonDay,
      models,
      maxOutputTokens,
      signal: controller.signal,
      metrics,
    }).then((day) => ({ dayIndex, day }));
    active.set(dayIndex, promise);
  };

  while (active.size < DAY_CONCURRENCY && nextDayIndex < TOTAL_DAYS) {
    startTask(nextDayIndex);
    nextDayIndex += 1;
  }

  while (active.size > 0) {
    const settled = await Promise.race(active.values());
    active.delete(settled.dayIndex);
    controllers.delete(settled.dayIndex);

    if (!settled.day) {
      failed = true;
      for (const controller of controllers.values()) {
        controller.abort();
      }
      break;
    }

    if (metrics.firstCompletedDayDurationMs === null) {
      metrics.firstCompletedDayDurationMs = Date.now() - weeklyStartedAt;
    }

    completedByIndex[settled.dayIndex] = {
      ...settled.day,
      meals: settled.day.meals.map((meal) => ({
        ...meal,
        targetCalories: budgetBySlot.get(meal.mealType) ?? meal.targetCalories,
      })),
    };
    completedCount += 1;

    yield {
      type: "day",
      dayIndex: settled.dayIndex,
      dailyPlan: completedByIndex[settled.dayIndex]!,
    };

    if (completedCount < TOTAL_DAYS) {
      const remaining = weekDates.find(
        (_, index) => completedByIndex[index] == null,
      );
      if (remaining) {
        yield {
          type: "progress",
          dayIndex: completedCount,
          totalDays,
          dayLabel: remaining.dayLabel,
          date: remaining.date,
        };
      }
    }

    while (active.size < DAY_CONCURRENCY && nextDayIndex < TOTAL_DAYS) {
      startTask(nextDayIndex);
      nextDayIndex += 1;
    }
  }

  if (failed || completedByIndex.some((day) => day == null)) {
    yield {
      type: "error",
      code: "INVALID_OUTPUT",
      message: "식단을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
    };
    return;
  }

  const finalizedDays = completedByIndex as WeeklyMealPlan["dailyPlans"];
  const shoppingSuggestions = buildShoppingSuggestionsFromPlans(finalizedDays);

  yield {
    type: "progress",
    dayIndex: TOTAL_DAYS,
    totalDays,
    dayLabel: "장보기",
    date: request.weekStartDate,
  };

  yield {
    type: "meta",
    shoppingSuggestions,
    safetyNote: SAFETY_NOTE,
  };

  const finalPlan: WeeklyMealPlan = {
    weekStartDate: request.weekStartDate,
    dailyPlans: finalizedDays,
    shoppingSuggestions,
    unmanagedMealCalories: unmanaged,
    safetyNote: SAFETY_NOTE,
  };

  const responseSchema = buildWeeklyPlanResponseSchema(
    request.weekStartDate,
    selectedSlots,
  );
  const validatedFinal = responseSchema.safeParse(finalPlan);
  if (!validatedFinal.success) {
    console.error(
      "[weekly-plan] final_schema_invalid",
      toIssuesSummary(validatedFinal.error.issues),
    );
    yield {
      type: "error",
      code: "INVALID_OUTPUT",
      message: "식단을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
    };
    return;
  }

  const totalDurationMs = Date.now() - weeklyStartedAt;
  console.info(
    `[weekly-plan] completed totalDurationMs=${totalDurationMs} skeletonDurationMs=${metrics.skeletonDurationMs} firstCompletedDayDurationMs=${metrics.firstCompletedDayDurationMs ?? -1} selectedSlots=${selectedSlots.length} calls=${metrics.geminiCalls} retries=${metrics.retries} rawPartials=${metrics.rawPartialCount} sentPartials=${metrics.sentPartialCount}`,
  );

  yield { type: "done", plan: validatedFinal.data };
}
