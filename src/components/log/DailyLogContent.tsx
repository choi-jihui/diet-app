"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { DailyLogSummary } from "@/components/log/DailyLogSummary";
import { ExtraFoodList } from "@/components/log/ExtraFoodList";
import { MealLogCard } from "@/components/log/MealLogCard";
import { WaterSleepSection } from "@/components/log/WaterSleepSection";
import { PageHeader } from "@/components/layout/PageHeader";
import { CARDIO_TYPE_LABELS } from "@/constants/cardio";
import { getMealSlotLabel } from "@/constants/meal-slots";
import { useDailyLog } from "@/hooks/useDailyLog";
import { useLocalWeek } from "@/hooks/useCardioPlan";
import {
  buildDailyFeedback,
  summarizeDailyLog,
} from "@/lib/calculations/daily-log-summary";
import { getWeeklyCardioPlan } from "@/lib/firebase/cardio-repo";
import { getWeeklyMealPlan } from "@/lib/firebase/meal-plan-repo";
import { useAuth } from "@/lib/auth/useAuth";
import {
  getProfileServerSnapshot,
  getProfileSnapshot,
  subscribeProfile,
} from "@/lib/storage/profile-storage";
import { buildDailyGoalsSnapshot } from "@/types/daily-log";
import { formatYmd, getWeekStartDate } from "@/lib/utils/date";
import type { WeeklyCardioPlan } from "@/types/cardio";
import type { DailyPlan, WeeklyMealPlan } from "@/types/meal";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function parseYmd(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shiftDate(value: string, days: number): string {
  const date = parseYmd(value);
  date.setDate(date.getDate() + days);
  return formatYmd(date);
}

function formatDateLabel(value: string): string {
  const date = parseYmd(value);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAY_LABELS[date.getDay()]}요일`;
}

export function DailyLogContent() {
  const { user } = useAuth();
  const profileData = useSyncExternalStore(
    subscribeProfile,
    getProfileSnapshot,
    getProfileServerSnapshot,
  );
  const localWeek = useLocalWeek();

  const [selectedDateState, setSelectedDateState] = useState<string | null>(null);
  const selectedDate = selectedDateState ?? localWeek?.today;

  const goalsSnapshotForLog =
    profileData?.profile && profileData?.targets
      ? buildDailyGoalsSnapshot(profileData.profile, profileData.targets)
      : null;

  const {
    log,
    status,
    loadError,
    saveIndicator,
    lastSaveError,
    saveMealLog,
    saveExtraFoods,
    addWater,
    saveWater,
    saveSleep,
    saveWeight,
    saveCardioCompleted,
  } = useDailyLog(user?.uid, selectedDate, goalsSnapshotForLog);

  const [mealPlan, setMealPlan] = useState<WeeklyMealPlan | null>(null);
  const [cardioPlan, setCardioPlan] = useState<WeeklyCardioPlan | null>(null);
  const planSeqRef = useRef(0);

  const weekStartDate = selectedDate
    ? getWeekStartDate(parseYmd(selectedDate))
    : undefined;

  useEffect(() => {
    if (!user?.uid || !weekStartDate) {
      return;
    }

    const seq = ++planSeqRef.current;

    (async () => {
      try {
        const [loadedMealPlan, loadedCardioPlan] = await Promise.all([
          getWeeklyMealPlan(user.uid, weekStartDate).catch(() => null),
          getWeeklyCardioPlan(user.uid, weekStartDate).catch(() => null),
        ]);
        // 최신 주차 요청만 반영
        if (seq !== planSeqRef.current) {
          return;
        }
        setMealPlan(loadedMealPlan);
        setCardioPlan(loadedCardioPlan);
      } catch {
        if (seq === planSeqRef.current) {
          setMealPlan(null);
          setCardioPlan(null);
        }
      }
    })();
  }, [user?.uid, weekStartDate]);

  if (!localWeek || !selectedDate) {
    return (
      <>
        <PageHeader title="오늘 기록" subtitle="먹은 만큼만 편하게 기록해요." />
        <div className="px-5 py-5">
          <div className="rounded-2xl border border-gakk-sage/40 bg-white p-5 text-sm text-gakk-text-muted">
            불러오는 중이에요...
          </div>
        </div>
      </>
    );
  }

  if (!profileData) {
    return (
      <>
        <PageHeader title="오늘 기록" subtitle="먹은 만큼만 편하게 기록해요." />
        <div className="px-5 py-5">
          <div className="rounded-2xl border border-gakk-sage/40 bg-white p-5">
            <p className="text-sm text-gakk-text">
              프로필을 설정하면 오늘 기록을 시작할 수 있어요.
            </p>
            <Link
              href="/onboarding"
              className="mt-3 inline-block text-sm font-medium text-gakk-mint underline"
            >
              프로필 설정하러 가기
            </Link>
          </div>
        </div>
      </>
    );
  }

  const { profile, targets } = profileData;
  const managedSlots = profile.selectedMealSlots;

  const today = localWeek.today;
  const minDate = shiftDate(today, -6); // 최근 7일
  const canGoPrev = selectedDate > minDate;
  const canGoNext = selectedDate < today; // 미래 날짜 금지

  const dayPlan: DailyPlan | undefined = mealPlan?.dailyPlans.find(
    (day) => day.date === selectedDate,
  );

  const cardioSession = cardioPlan?.sessions.find(
    (session) => session.date === selectedDate,
  );
  const cardioCompleted = Boolean(
    cardioSession &&
      log?.cardio &&
      log.cardio.completed &&
      log.cardio.plannedSessionId === cardioSession.id,
  );

  const summary = summarizeDailyLog({
    log,
    managedSlots,
    targetCalories: targets.targetCalories,
  });
  const feedbackLines = buildDailyFeedback(
    summary,
    log?.waterMl,
    targets.waterGoalMl,
  );

  const saveStatusText =
    saveIndicator === "saving"
      ? "저장 중..."
      : saveIndicator === "saved"
        ? "저장됨"
        : saveIndicator === "error"
          ? (lastSaveError ?? "저장하지 못했어요 · 다시 시도해 주세요")
          : null;

  return (
    <>
      <PageHeader title="오늘 기록" subtitle="먹은 만큼만 편하게 기록해요." />

      <div className="space-y-4 px-5 py-5">
        {/* 1. 날짜 선택 */}
        <div className="flex items-center justify-between rounded-2xl border border-gakk-sage/40 bg-white px-3 py-2.5 shadow-sm">
          <button
            type="button"
            onClick={() => canGoPrev && setSelectedDateState(shiftDate(selectedDate, -1))}
            disabled={!canGoPrev}
            aria-label="이전 날짜"
            className={`h-9 w-9 rounded-xl text-lg ${
              canGoPrev ? "text-gakk-text" : "text-gakk-text-muted/30"
            }`}
          >
            ‹
          </button>
          <p className="text-sm font-semibold text-gakk-text">
            {formatDateLabel(selectedDate)}
            {selectedDate === today ? (
              <span className="ml-1 text-xs font-medium text-gakk-mint">오늘</span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={() => canGoNext && setSelectedDateState(shiftDate(selectedDate, 1))}
            disabled={!canGoNext}
            aria-label="다음 날짜"
            className={`h-9 w-9 rounded-xl text-lg ${
              canGoNext ? "text-gakk-text" : "text-gakk-text-muted/30"
            }`}
          >
            ›
          </button>
        </div>

        {saveStatusText ? (
          <p
            className={`px-1 text-right text-xs ${
              saveIndicator === "error" ? "text-gakk-coral" : "text-gakk-text-muted"
            }`}
          >
            {saveStatusText}
          </p>
        ) : null}

        {status === "loading" ? (
          <div className="rounded-2xl border border-gakk-sage/40 bg-white p-5 text-sm text-gakk-text-muted">
            기록을 불러오는 중이에요...
          </div>
        ) : status === "error" ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-600">
            {loadError ?? "기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."}
          </div>
        ) : (
          <>
            {/* 2. 총칼로리 요약 */}
            <DailyLogSummary summary={summary} feedbackLines={feedbackLines} />

            {/* 3. 계획된 식사 기록 */}
            <div className="space-y-3">
              {managedSlots.map((slot) => (
                <MealLogCard
                  key={`${selectedDate}-${slot}`}
                  slot={slot}
                  slotLabel={getMealSlotLabel(slot)}
                  plannedMeal={dayPlan?.meals.find(
                    (meal) => meal.mealType === slot,
                  )}
                  mealLog={log?.meals?.[slot]}
                  onSave={(mealLog) => saveMealLog(selectedDate, slot, mealLog)}
                />
              ))}
            </div>

            {/* 4. 추가 음식·간식 */}
            <ExtraFoodList
              key={`extra-${selectedDate}`}
              foods={log?.extraFoods ?? []}
              onSave={(foods) => saveExtraFoods(selectedDate, foods)}
            />

            {/* 5~6. 물·수면·선택적 몸무게 */}
            <WaterSleepSection
              key={`ws-${selectedDate}-${status}`}
              waterMl={log?.waterMl ?? 0}
              waterGoalMl={targets.waterGoalMl}
              sleepHours={log?.sleepHours}
              weightKg={log?.weightKg}
              onAddWater={(delta) => addWater(selectedDate, delta)}
              onSetWater={(value) => saveWater(selectedDate, value)}
              onSaveSleep={(hours) => saveSleep(selectedDate, hours)}
              onSaveWeight={(kg) => saveWeight(selectedDate, kg)}
            />

            {/* 7. 유산소 상태 (Phase 7 dailyLogs.cardio 공유) */}
            <div className="rounded-2xl border border-gakk-sage/40 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-gakk-text">유산소</p>
              {cardioSession ? (
                <label className="mt-3 flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={cardioCompleted}
                    onChange={(event) =>
                      cardioPlan &&
                      saveCardioCompleted(
                        selectedDate,
                        cardioSession,
                        cardioPlan.weekStartDate,
                        event.target.checked,
                      )
                    }
                    className="h-5 w-5 rounded accent-gakk-mint"
                  />
                  <span className="text-sm text-gakk-text">
                    {CARDIO_TYPE_LABELS[cardioSession.type]}{" "}
                    {cardioSession.durationMin}분 완료
                  </span>
                </label>
              ) : (
                <p className="mt-2 text-sm text-gakk-text-muted">
                  오늘은 계획된 유산소가 없어요.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
