import type { DailyLog, MealLog } from "@/types/daily-log";
import type { MealSlotType } from "@/types/meal";

/**
 * Phase 8 하루 기록 집계. 순수 함수로 유지한다(Gemini 미사용).
 * - unlogged(필드 부재)는 0으로 확정하지 않고 합산에서 제외한다.
 * - skipped만 0 kcal로 확정한다.
 */

export interface DailyLogSummaryInput {
  log: DailyLog | null;
  managedSlots: MealSlotType[];
  targetCalories: number;
}

export interface DailyLogSummaryResult {
  consumedCalories: number;
  targetCalories: number;
  differenceCalories: number;
  loggedManagedMealCount: number;
  totalManagedMealCount: number;
  hasUnloggedMeals: boolean;
  /** 식사·추가 음식 기록이 1건이라도 있는지 (instant 연동 게이트) */
  hasAnyFoodRecord: boolean;
  knownProteinTotalG: number;
  hasUnknownProteinEntries: boolean;
}

function mealCalories(meal: MealLog): number {
  if (meal.status === "planned") {
    return meal.plannedOption?.estimatedCalories ?? 0;
  }
  if (meal.status === "custom") {
    return (meal.customEntries ?? []).reduce(
      (sum, entry) => sum + entry.calories,
      0,
    );
  }
  return 0;
}

export function summarizeDailyLog({
  log,
  managedSlots,
  targetCalories,
}: DailyLogSummaryInput): DailyLogSummaryResult {
  const meals = log?.meals ?? {};
  const extraFoods = log?.extraFoods ?? [];

  let consumed = 0;
  let knownProtein = 0;
  let hasUnknownProtein = false;
  let loggedManagedCount = 0;

  for (const slot of managedSlots) {
    const meal = meals[slot];
    if (!meal) {
      continue;
    }
    loggedManagedCount += 1;
    consumed += mealCalories(meal);

    if (meal.status === "planned" && meal.plannedOption) {
      knownProtein += meal.plannedOption.estimatedProteinG;
    }
    if (meal.status === "custom") {
      for (const entry of meal.customEntries ?? []) {
        if (typeof entry.proteinG === "number") {
          knownProtein += entry.proteinG;
        } else {
          hasUnknownProtein = true;
        }
      }
    }
  }

  // 관리 슬롯 외의 끼니 기록(방어적): 합산에는 포함한다.
  for (const [slot, meal] of Object.entries(meals)) {
    if (!meal || managedSlots.includes(slot as MealSlotType)) {
      continue;
    }
    consumed += mealCalories(meal);
  }

  for (const entry of extraFoods) {
    consumed += entry.calories;
    if (typeof entry.proteinG === "number") {
      knownProtein += entry.proteinG;
    } else {
      hasUnknownProtein = true;
    }
  }

  const hasAnyFoodRecord =
    Object.keys(meals).length > 0 || extraFoods.length > 0;

  return {
    consumedCalories: consumed,
    targetCalories,
    differenceCalories: targetCalories - consumed,
    loggedManagedMealCount: loggedManagedCount,
    totalManagedMealCount: managedSlots.length,
    hasUnloggedMeals: loggedManagedCount < managedSlots.length,
    hasAnyFoodRecord,
    knownProteinTotalG: Math.round(knownProtein),
    hasUnknownProteinEntries: hasUnknownProtein,
  };
}

/**
 * 규칙 기반 짧은 하루 피드백.
 * 금지: 실패/망함/벌칙/굶기/운동 만회/극단적 조절 표현.
 */
export function buildDailyFeedback(
  summary: DailyLogSummaryResult,
  waterMl: number | undefined,
  waterGoalMl: number,
): string[] {
  const lines: string[] = [];

  if (!summary.hasAnyFoodRecord) {
    lines.push("먹은 내용을 기록하면 오늘 흐름을 확인할 수 있어요.");
  } else {
    const nearRange = Math.max(100, Math.round(summary.targetCalories * 0.1));
    if (Math.abs(summary.differenceCalories) <= nearRange) {
      lines.push("오늘 목표 범위와 가깝게 기록됐어요.");
    } else if (summary.differenceCalories < 0) {
      lines.push(
        "오늘은 목표보다 조금 높게 기록됐지만 괜찮아요. 다음 끼니도 평소 흐름대로 이어가요.",
      );
    } else if (summary.hasUnloggedMeals) {
      lines.push("아직 기록하지 않은 끼니가 있어요. 천천히 채워도 괜찮아요.");
    } else {
      lines.push("오늘 기록을 잘 채웠어요. 입력한 항목 기준으로 여유가 있어요.");
    }
  }

  if (
    typeof waterMl === "number" &&
    waterGoalMl > 0 &&
    waterMl >= waterGoalMl
  ) {
    lines.push("오늘 물 목표를 채웠어요.");
  }

  return lines;
}
