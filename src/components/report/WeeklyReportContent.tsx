"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { WeeklyMetricRow } from "@/components/report/WeeklyMetricRow";
import { WeeklySummarySection } from "@/components/report/WeeklySummarySection";
import { useWeeklyReport } from "@/hooks/useWeeklyReport";
import { useAuth } from "@/lib/auth/useAuth";
import { formatWeekRangeKo } from "@/lib/utils/date";
import {
  getProfileServerSnapshot,
  getProfileSnapshot,
  subscribeProfile,
} from "@/lib/storage/profile-storage";

function formatSignedKg(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded > 0) {
    return `+${rounded}kg`;
  }
  return `${rounded}kg`;
}

export function WeeklyReportContent() {
  const { user } = useAuth();
  const profileData = useSyncExternalStore(
    subscribeProfile,
    getProfileSnapshot,
    getProfileServerSnapshot,
  );

  const {
    status,
    error,
    summary,
    canGoPrev,
    canGoNext,
    goPrevWeek,
    goNextWeek,
  } = useWeeklyReport(user?.uid, profileData);

  if (!profileData) {
    return (
      <>
        <PageHeader
          backHref="/dashboard"
          title="주간 리포트"
          subtitle="일주일 기록을 함께 돌아볼 수 있어요."
        />
        <div className="px-5 py-5">
          <div className="rounded-2xl border border-gakk-sage/40 bg-white p-5">
            <p className="text-sm text-gakk-text">
              프로필을 설정하면 주간 리포트를 볼 수 있어요.
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

  if (status === "loading") {
    return (
      <>
        <PageHeader
          backHref="/dashboard"
          title="주간 리포트"
          subtitle="일주일 기록을 함께 돌아볼 수 있어요."
        />
        <div className="px-5 py-5">
          <div className="rounded-2xl border border-gakk-sage/40 bg-white p-5 text-sm text-gakk-text-muted">
            불러오는 중이에요...
          </div>
        </div>
      </>
    );
  }

  if (status === "error" || !summary) {
    return (
      <>
        <PageHeader
          backHref="/dashboard"
          title="주간 리포트"
          subtitle="일주일 기록을 함께 돌아볼 수 있어요."
        />
        <div className="px-5 py-5">
          <div className="rounded-2xl border border-gakk-sage/40 bg-white p-5 text-sm text-gakk-text">
            {error ?? "주간 리포트를 불러오지 못했어요."}
          </div>
        </div>
      </>
    );
  }

  const weekRangeLabel = formatWeekRangeKo(summary.weekStartDate);
  const isEmptyWeek = summary.recordedDayCount === 0;

  const mealValue = isEmptyWeek
    ? "—"
    : `${summary.mealLogging.loggedManagedMeals}/${summary.mealLogging.expectedManagedMeals}끼`;
  const mealDetail = isEmptyWeek
    ? undefined
    : `계획 메뉴 선택 ${summary.mealLogging.plannedMeals}/${summary.mealLogging.plannedMeals + summary.mealLogging.customMeals + summary.mealLogging.skippedMeals}끼`;

  const calorieValue =
    summary.calories.daysWithCalorieRecords === 0
      ? "기록 없음"
      : `기록한 ${summary.calories.daysWithCalorieRecords}일 평균 약 ${summary.calories.averageRecordedCalories?.toLocaleString()} kcal`;

  const waterValue =
    summary.water.recordedDays === 0
      ? "기록 없음"
      : `기록한 ${summary.water.recordedDays}일 중 ${summary.water.achievedDays}일 목표 달성`;
  const waterDetail =
    summary.water.averageWaterMl !== null
      ? `평균 ${summary.water.averageWaterMl.toLocaleString()}ml`
      : undefined;

  const cardioValue = !summary.cardio.hasPlan
    ? "계획 없음"
    : `${summary.cardio.completedSessions}/${summary.cardio.plannedSessions}회 완료`;

  return (
    <>
      <PageHeader
        backHref="/dashboard"
        title="주간 리포트"
        subtitle="일주일 기록을 함께 돌아볼 수 있어요."
      />

      <div className="space-y-4 px-5 py-5">
        <WeeklySummarySection
          summary={summary}
          weekRangeLabel={weekRangeLabel}
          onPrev={goPrevWeek}
          onNext={goNextWeek}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
        />

        {isEmptyWeek ? (
          <div className="rounded-2xl border border-gakk-sage/40 bg-white p-5">
            <p className="text-sm text-gakk-text">
              아직 이번 주 기록이 없어요.
            </p>
            <p className="mt-2 text-sm text-gakk-text-muted">
              오늘 먹은 내용이나 물 한 잔부터 기록해볼까요?
            </p>
            <Link
              href="/log"
              className="mt-4 flex h-11 items-center justify-center rounded-2xl bg-gakk-mint text-sm font-semibold text-white"
            >
              오늘 기록하기 →
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <WeeklyMetricRow
                label="식사 기록"
                value={mealValue}
                detail={mealDetail}
                progressPercent={summary.mealLogging.loggingRatePercent}
              />
              <WeeklyMetricRow
                label="칼로리"
                value={calorieValue}
                detail={
                  summary.calories.daysWithCalorieRecords > 0
                    ? "기록한 날 기준"
                    : undefined
                }
              />
              <WeeklyMetricRow
                label="물"
                value={waterValue}
                detail={waterDetail}
                progressPercent={summary.water.achievementRatePercent}
              />
              <WeeklyMetricRow
                label="유산소"
                value={cardioValue}
                progressPercent={summary.cardio.completionRatePercent}
              />
            </div>

            {summary.sleep.recordedDays > 0 ? (
              <WeeklyMetricRow
                label="수면"
                value={`기록한 ${summary.sleep.recordedDays}일 평균 ${summary.sleep.averageHours}시간`}
              />
            ) : null}

            {summary.weight.recordedDays > 0 ? (
              <WeeklyMetricRow
                label="몸무게"
                value={
                  summary.weight.changeKg !== null
                    ? `기록 변화 ${formatSignedKg(summary.weight.changeKg)}`
                    : `기록 ${summary.weight.recordedDays}일`
                }
                detail={
                  summary.weight.changeKg !== null
                    ? "수분·측정 시간에 따라 달라질 수 있어요."
                    : undefined
                }
              />
            ) : null}

            {summary.wins.length > 0 ? (
              <div className="rounded-2xl border border-gakk-sage/40 bg-gakk-lime/15 p-4">
                <p className="text-sm font-semibold text-gakk-text">
                  이번 주 잘한 점
                </p>
                <ul className="mt-2 space-y-1">
                  {summary.wins.map((win) => (
                    <li key={win} className="text-sm text-gakk-text-muted">
                      {win}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rounded-2xl border border-gakk-sage/40 bg-gakk-mint/10 p-4">
              <p className="text-sm font-semibold text-gakk-text">
                다음 주 한 가지 전략
              </p>
              <p className="mt-2 text-sm text-gakk-text-muted">
                {summary.nextStrategy}
              </p>
            </div>
          </>
        )}

        <p className="text-xs leading-relaxed text-gakk-text-muted">
          기록이 없는 날은 0으로 계산하지 않아요. 미기록은 평가에서 제외되며,
          과거 목표는 기록 시점 설정을 우선 사용해요.
        </p>
      </div>
    </>
  );
}
