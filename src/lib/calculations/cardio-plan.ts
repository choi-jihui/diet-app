import { buildWeekDates } from "@/lib/utils/date";
import type {
  CardioSession,
  CardioSessionIntensity,
  CardioSettings,
  CardioType,
} from "@/types/cardio";
import type { ActivityLevel, CardioIntensity } from "@/types/user";

/**
 * Phase 7 규칙 기반 유산소 루틴 생성기.
 * - 랜덤 사용 금지: 동일 입력 → 동일 출력
 * - age/weightKg는 입력으로 받지 않는다(의료적 처방·심박수 계산 금지)
 */

const TARGET_COUNT: Record<Exclude<CardioIntensity, "none">, number> = {
  two_days: 2,
  three_days: 3,
  five_days: 5,
};

export function getCardioTargetCount(intensity: CardioIntensity): number {
  return intensity === "none" ? 0 : TARGET_COUNT[intensity];
}

function normalizeDays(days: number[]): number[] {
  return Array.from(new Set(days))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
}

/** 사전순(월요일 우선)으로 조합을 열거한다. */
function enumerateCombinations(items: number[], size: number): number[][] {
  const results: number[][] = [];
  const current: number[] = [];

  function walk(startIndex: number) {
    if (current.length === size) {
      results.push([...current]);
      return;
    }
    for (let i = startIndex; i < items.length; i += 1) {
      current.push(items[i]);
      walk(i + 1);
      current.pop();
    }
  }

  walk(0);
  return results;
}

/** 점수: (1) 인접 세션 최소 간격 최대화 → (2) 전체 분산(첫날~마지막날) 최대화 */
function scoreCombination(days: number[]): [number, number] {
  if (days.length < 2) {
    return [7, 0];
  }
  let minGap = 7;
  for (let i = 1; i < days.length; i += 1) {
    minGap = Math.min(minGap, days[i] - days[i - 1]);
  }
  const spread = days[days.length - 1] - days[0];
  return [minGap, spread];
}

/**
 * 가능한 요일 안에서만 세션 요일을 deterministic하게 고른다.
 * 요일이 부족하면 null을 반환한다(자동 배치·횟수 축소 금지).
 */
export function selectSessionDays(
  availableDays: number[],
  targetCount: number,
): number[] | null {
  const days = normalizeDays(availableDays);
  if (targetCount <= 0 || days.length < targetCount) {
    return null;
  }

  const combinations = enumerateCombinations(days, targetCount);
  let best: number[] | null = null;
  let bestScore: [number, number] = [-1, -1];

  for (const combo of combinations) {
    const score = scoreCombination(combo);
    // 동점이면 사전순으로 먼저 나온 조합(월요일 우선) 유지
    if (
      score[0] > bestScore[0] ||
      (score[0] === bestScore[0] && score[1] > bestScore[1])
    ) {
      best = combo;
      bestScore = score;
    }
  }

  return best;
}

function baseIntensityPattern(
  experience: CardioSettings["cardioExperience"],
  activityLevel: ActivityLevel,
  count: number,
): CardioSessionIntensity[] {
  if (experience === "beginner" || activityLevel === "sedentary") {
    return Array.from({ length: count }, () => "easy");
  }

  if (experience === "intermediate") {
    return Array.from({ length: count }, (_, index) =>
      index % 2 === 0 ? "moderate" : "easy",
    );
  }

  // experienced: moderate 중심, 마지막 세션은 회복용 easy
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 && count > 1 ? "easy" : "moderate",
  );
}

function durationFor(
  intensity: CardioSessionIntensity,
  preferredDurationMin: number,
): number {
  if (intensity === "moderate") {
    return preferredDurationMin;
  }
  return Math.max(15, preferredDurationMin - 10);
}

function noteFor(intensity: CardioSessionIntensity, type: CardioType): string {
  if (intensity === "easy") {
    return "대화가 가능한 편한 속도면 충분해요.";
  }
  if (type === "walking") {
    return "평소보다 약간 빠른 걸음으로 걸어보세요.";
  }
  return "약간 숨이 차는 정도로, 무리하지 않게 진행해 보세요.";
}

function normalizeTypes(types: CardioType[]): CardioType[] {
  return Array.from(new Set(types));
}

export interface BuildCardioPlanInput {
  weekStartDate: string;
  cardioIntensity: CardioIntensity;
  activityLevel: ActivityLevel;
  settings: CardioSettings;
}

export type BuildCardioPlanResult =
  | {
      ok: true;
      weekStartDate: string;
      settings: CardioSettings;
      sessions: CardioSession[];
    }
  | {
      ok: false;
      reason: "no_cardio" | "no_types" | "not_enough_days";
      requiredDays?: number;
    };

export function buildWeeklyCardioSessions(
  input: BuildCardioPlanInput,
): BuildCardioPlanResult {
  const targetCount = getCardioTargetCount(input.cardioIntensity);
  if (targetCount === 0) {
    return { ok: false, reason: "no_cardio" };
  }

  const types = normalizeTypes(input.settings.preferredCardioTypes);
  if (types.length === 0) {
    return { ok: false, reason: "no_types" };
  }

  const selectedDays = selectSessionDays(
    input.settings.availableDays,
    targetCount,
  );
  if (!selectedDays) {
    return { ok: false, reason: "not_enough_days", requiredDays: targetCount };
  }

  const weekDates = buildWeekDates(input.weekStartDate);
  const intensities = baseIntensityPattern(
    input.settings.cardioExperience,
    input.activityLevel,
    selectedDays.length,
  );

  // 연속 이틀이 불가피하면 둘째 날은 easy로 강등한다.
  for (let i = 1; i < selectedDays.length; i += 1) {
    if (selectedDays[i] === selectedDays[i - 1] + 1) {
      intensities[i] = "easy";
    }
  }

  const normalizedSettings: CardioSettings = {
    cardioExperience: input.settings.cardioExperience,
    preferredDurationMin: input.settings.preferredDurationMin,
    preferredCardioTypes: types,
    availableDays: normalizeDays(input.settings.availableDays),
  };

  const sessions: CardioSession[] = selectedDays.map((dayIndex, index) => {
    const weekDate = weekDates[dayIndex];
    const type = types[index % types.length];
    const intensity = intensities[index];

    return {
      id: `${input.weekStartDate}-${weekDate.date}-${type}-${index}`,
      date: weekDate.date,
      dayLabel: weekDate.dayLabel,
      dayIndex,
      type,
      durationMin: durationFor(intensity, input.settings.preferredDurationMin),
      intensity,
      note: noteFor(intensity, type),
    };
  });

  return {
    ok: true,
    weekStartDate: input.weekStartDate,
    settings: normalizedSettings,
    sessions,
  };
}
