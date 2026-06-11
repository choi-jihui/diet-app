import { summarizeDailyLog } from "@/lib/calculations/daily-log-summary";
import {
  buildWeekDates,
  getElapsedDayCount,
  isCurrentWeek,
} from "@/lib/utils/date";
import type { WeeklyCardioPlan } from "@/types/cardio";
import type { DailyGoalsSnapshot, DailyLog } from "@/types/daily-log";
import type { WeeklyReportSummary } from "@/types/weekly-report";

export const CALORIE_TARGET_TOLERANCE = 0.1;

export interface WeeklyReportInput {
  weekStartDate: string;
  today: string;
  logsByDate: Record<string, DailyLog | null>;
  fallbackGoals: DailyGoalsSnapshot;
  cardioPlan: WeeklyCardioPlan | null;
  cardioIntensityNone: boolean;
}

/** 분모 0이면 null, 0~100 clamp, Math.round */
export function safePercent(
  numerator: number,
  denominator: number,
): number | null {
  if (denominator <= 0) {
    return null;
  }
  const raw = Math.round((numerator / denominator) * 100);
  return Math.min(100, Math.max(0, raw));
}

export function resolveDayGoals(
  log: DailyLog | null,
  fallback: DailyGoalsSnapshot,
): DailyGoalsSnapshot {
  return log?.goalsSnapshot ?? fallback;
}

/** goalsSnapshot·createdAt만 있는 빈 문서는 제외한다. */
export function isRecordedDay(log: DailyLog | null): boolean {
  if (!log) {
    return false;
  }

  const meals = log.meals ?? {};
  if (Object.keys(meals).length > 0) {
    return true;
  }
  if ((log.extraFoods ?? []).length > 0) {
    return true;
  }
  if (typeof log.waterMl === "number") {
    return true;
  }
  if (typeof log.sleepHours === "number") {
    return true;
  }
  if (typeof log.weightKg === "number") {
    return true;
  }
  if (log.cardio) {
    return true;
  }

  return false;
}

function getEligibleDates(
  weekStartDate: string,
  today: string,
  currentWeek: boolean,
): string[] {
  const weekDates = buildWeekDates(weekStartDate);
  const elapsedDayCount = getElapsedDayCount(weekStartDate, today, currentWeek);
  const slice = currentWeek ? weekDates.slice(0, elapsedDayCount) : weekDates;
  return slice.map((entry) => entry.date);
}

function aggregateMeals(
  eligibleDates: string[],
  logsByDate: Record<string, DailyLog | null>,
  fallbackGoals: DailyGoalsSnapshot,
) {
  let expectedManagedMeals = 0;
  let loggedManagedMeals = 0;
  let plannedMeals = 0;
  let customMeals = 0;
  let skippedMeals = 0;
  let unloggedMeals = 0;

  for (const date of eligibleDates) {
    const log = logsByDate[date] ?? null;
    const goals = resolveDayGoals(log, fallbackGoals);
    const managedSlots = goals.managedMealSlots;
    expectedManagedMeals += managedSlots.length;

    const meals = log?.meals ?? {};
    for (const slot of managedSlots) {
      const meal = meals[slot];
      if (!meal) {
        unloggedMeals += 1;
        continue;
      }
      loggedManagedMeals += 1;
      if (meal.status === "planned") {
        plannedMeals += 1;
      } else if (meal.status === "custom") {
        customMeals += 1;
      } else if (meal.status === "skipped") {
        skippedMeals += 1;
      }
    }
  }

  const loggedTotal = plannedMeals + customMeals + skippedMeals;

  return {
    loggedManagedMeals,
    expectedManagedMeals,
    loggingRatePercent: safePercent(loggedManagedMeals, expectedManagedMeals),
    plannedMeals,
    customMeals,
    skippedMeals,
    unloggedMeals,
    plannedChoiceRatePercent: safePercent(plannedMeals, loggedTotal),
  };
}

function aggregateCalories(
  eligibleDates: string[],
  logsByDate: Record<string, DailyLog | null>,
  fallbackGoals: DailyGoalsSnapshot,
) {
  let daysWithCalorieRecords = 0;
  let calorieSum = 0;
  let targetSum = 0;
  let daysNearTarget = 0;

  for (const date of eligibleDates) {
    const log = logsByDate[date] ?? null;
    const goals = resolveDayGoals(log, fallbackGoals);
    const summary = summarizeDailyLog({
      log,
      managedSlots: goals.managedMealSlots,
      targetCalories: goals.targetCalories,
    });

    if (!summary.hasCalorieEntries) {
      continue;
    }

    daysWithCalorieRecords += 1;
    calorieSum += summary.consumedCalories;
    targetSum += goals.targetCalories;

    const tolerance = Math.max(
      100,
      Math.round(goals.targetCalories * CALORIE_TARGET_TOLERANCE),
    );
    if (Math.abs(summary.consumedCalories - goals.targetCalories) <= tolerance) {
      daysNearTarget += 1;
    }
  }

  return {
    daysWithCalorieRecords,
    averageRecordedCalories:
      daysWithCalorieRecords > 0
        ? Math.round(calorieSum / daysWithCalorieRecords)
        : null,
    averageTargetCalories:
      daysWithCalorieRecords > 0
        ? Math.round(targetSum / daysWithCalorieRecords)
        : null,
    daysNearTarget,
  };
}

function aggregateWater(
  eligibleDates: string[],
  logsByDate: Record<string, DailyLog | null>,
  fallbackGoals: DailyGoalsSnapshot,
) {
  let recordedDays = 0;
  let achievedDays = 0;
  let waterSum = 0;

  for (const date of eligibleDates) {
    const log = logsByDate[date] ?? null;
    if (typeof log?.waterMl !== "number") {
      continue;
    }

    const goals = resolveDayGoals(log, fallbackGoals);
    recordedDays += 1;
    waterSum += log.waterMl;
    if (log.waterMl >= goals.waterGoalMl) {
      achievedDays += 1;
    }
  }

  return {
    recordedDays,
    achievedDays,
    achievementRatePercent: safePercent(achievedDays, recordedDays),
    averageWaterMl:
      recordedDays > 0 ? Math.round(waterSum / recordedDays) : null,
  };
}

function aggregateSleep(
  eligibleDates: string[],
  logsByDate: Record<string, DailyLog | null>,
) {
  let recordedDays = 0;
  let sleepSum = 0;

  for (const date of eligibleDates) {
    const log = logsByDate[date] ?? null;
    if (typeof log?.sleepHours !== "number") {
      continue;
    }
    recordedDays += 1;
    sleepSum += log.sleepHours;
  }

  return {
    recordedDays,
    averageHours:
      recordedDays > 0
        ? Math.round((sleepSum / recordedDays) * 10) / 10
        : null,
  };
}

function aggregateCardio(
  eligibleDates: string[],
  logsByDate: Record<string, DailyLog | null>,
  cardioPlan: WeeklyCardioPlan | null,
  weekStartDate: string,
  cardioIntensityNone: boolean,
) {
  if (cardioIntensityNone || !cardioPlan) {
    return {
      plannedSessions: 0,
      completedSessions: 0,
      completionRatePercent: null,
      hasPlan: false,
    };
  }

  const eligibleSet = new Set(eligibleDates);
  const plannedSessionsList = cardioPlan.sessions.filter((session) =>
    eligibleSet.has(session.date),
  );
  const planSessionIds = new Set(plannedSessionsList.map((session) => session.id));
  const plannedSessions = planSessionIds.size;

  if (plannedSessions === 0) {
    return {
      plannedSessions: 0,
      completedSessions: 0,
      completionRatePercent: null,
      hasPlan: false,
    };
  }

  const completedSessionIds = new Set<string>();
  for (const date of eligibleDates) {
    const cardio = logsByDate[date]?.cardio;
    if (!cardio?.completed) {
      continue;
    }
    if (cardio.planWeekStartDate !== weekStartDate) {
      continue;
    }
    if (!planSessionIds.has(cardio.plannedSessionId)) {
      continue;
    }
    completedSessionIds.add(cardio.plannedSessionId);
  }

  const completedSessions = completedSessionIds.size;

  return {
    plannedSessions,
    completedSessions,
    completionRatePercent: safePercent(completedSessions, plannedSessions),
    hasPlan: true,
  };
}

function aggregateWeight(
  eligibleDates: string[],
  logsByDate: Record<string, DailyLog | null>,
) {
  const weights: number[] = [];

  for (const date of eligibleDates) {
    const weight = logsByDate[date]?.weightKg;
    if (typeof weight === "number") {
      weights.push(weight);
    }
  }

  const recordedDays = weights.length;
  const firstKg = recordedDays > 0 ? weights[0] : null;
  const lastKg = recordedDays > 0 ? weights[weights.length - 1] : null;
  const changeKg =
    recordedDays >= 2 && firstKg !== null && lastKg !== null
      ? Math.round((lastKg - firstKg) * 10) / 10
      : null;

  return {
    recordedDays,
    firstKg,
    lastKg,
    changeKg,
  };
}

export function buildWeeklyWins(summary: WeeklyReportSummary): string[] {
  const wins: string[] = [];
  const { mealLogging, water, cardio, sleep, recordedDayCount } = summary;

  if (
    mealLogging.loggingRatePercent !== null &&
    mealLogging.loggingRatePercent >= 70
  ) {
    wins.push("이번 주 식사 기록을 꾸준히 남겼어요.");
  }

  if (
    mealLogging.plannedChoiceRatePercent !== null &&
    mealLogging.plannedChoiceRatePercent >= 60
  ) {
    wins.push("계획한 메뉴를 여러 끼 실천했어요.");
  }

  if (
    water.recordedDays >= 2 &&
    water.achievementRatePercent !== null &&
    water.achievementRatePercent >= 70
  ) {
    wins.push("물을 기록한 날에는 목표를 잘 챙겼어요.");
  }

  if (
    cardio.hasPlan &&
    cardio.plannedSessions >= 1 &&
    cardio.completionRatePercent !== null &&
    cardio.completionRatePercent >= 70
  ) {
    wins.push("계획한 유산소를 꾸준히 완료했어요.");
  }

  if (sleep.recordedDays >= 4) {
    wins.push("수면 기록을 꾸준히 남겼어요.");
  }

  if (wins.length === 0 && recordedDayCount > 0) {
    wins.push(
      "이번 주 기록을 시작한 것 자체가 다음 흐름을 만드는 첫 단계예요.",
    );
  }

  return wins.slice(0, 3);
}

export function pickNextStrategy(summary: WeeklyReportSummary): string {
  const { recordedDayCount, mealLogging, water, cardio, sleep } = summary;

  if (recordedDayCount < 3) {
    return "다음 주에는 하루에 한 가지(식사·물·수면)만 먼저 기록해 보세요.";
  }

  if (
    mealLogging.loggingRatePercent !== null &&
    mealLogging.loggingRatePercent < 50
  ) {
    return "다음 주에는 하루 한 끼부터 체크해 보세요.";
  }

  if (water.recordedDays < 3) {
    return "물 기록은 빠른 추가 버튼으로 한 잔씩 남겨 보세요.";
  }

  if (
    water.recordedDays >= 2 &&
    water.achievementRatePercent !== null &&
    water.achievementRatePercent < 50
  ) {
    return "다음 주에는 아침에 물 250ml부터 기록해 보세요.";
  }

  if (
    cardio.hasPlan &&
    cardio.plannedSessions > 0 &&
    cardio.completionRatePercent !== null &&
    cardio.completionRatePercent < 50
  ) {
    return "다음 주에는 운동 가능한 요일·시간을 다시 정해 보세요.";
  }

  if (sleep.recordedDays < 3) {
    return "수면 시간을 간단히 적어 두면 이번 주 흐름을 더 잘 볼 수 있어요.";
  }

  return "지금 흐름을 유지하면서 기록을 이어가 보세요.";
}

export function buildWeeklyReportSummary(
  input: WeeklyReportInput,
): WeeklyReportSummary {
  const { weekStartDate, today, logsByDate, fallbackGoals, cardioPlan } =
    input;
  const currentWeek = isCurrentWeek(weekStartDate, today);
  const eligibleDates = getEligibleDates(weekStartDate, today, currentWeek);
  const elapsedDayCount = getElapsedDayCount(weekStartDate, today, currentWeek);
  const weekDates = buildWeekDates(weekStartDate);

  const recordedDayCount = eligibleDates.filter((date) =>
    isRecordedDay(logsByDate[date] ?? null),
  ).length;

  const mealLogging = aggregateMeals(eligibleDates, logsByDate, fallbackGoals);
  const calories = aggregateCalories(eligibleDates, logsByDate, fallbackGoals);
  const water = aggregateWater(eligibleDates, logsByDate, fallbackGoals);
  const sleep = aggregateSleep(eligibleDates, logsByDate);
  const cardio = aggregateCardio(
    eligibleDates,
    logsByDate,
    cardioPlan,
    weekStartDate,
    input.cardioIntensityNone,
  );
  const weight = aggregateWeight(eligibleDates, logsByDate);

  const partial: WeeklyReportSummary = {
    weekStartDate,
    weekEndDate: weekDates[6].date,
    isCurrentWeek: currentWeek,
    elapsedDayCount,
    eligibleDayCount: eligibleDates.length,
    recordedDayCount,
    totalDayCount: 7,
    mealLogging,
    calories,
    water,
    sleep,
    cardio,
    weight,
    wins: [],
    nextStrategy: "",
  };

  return {
    ...partial,
    wins: buildWeeklyWins(partial),
    nextStrategy: pickNextStrategy(partial),
  };
}
