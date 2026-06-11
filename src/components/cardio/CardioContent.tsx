"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CardioSetupForm } from "@/components/cardio/CardioSetupForm";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  CARDIO_INTENSITY_SESSION_LABELS,
  CARDIO_TYPE_LABELS,
} from "@/constants/cardio";
import { getCardioIntensityLabel } from "@/constants/onboarding-labels";
import { getCardioTargetCount } from "@/lib/calculations/cardio-plan";
import { useCardioPlan, useLocalWeek } from "@/hooks/useCardioPlan";
import { useAuth } from "@/lib/auth/useAuth";
import {
  getProfileServerSnapshot,
  getProfileSnapshot,
  subscribeProfile,
} from "@/lib/storage/profile-storage";
import type { CardioSession, CardioSettings } from "@/types/cardio";

const REGENERATE_CONFIRM =
  "이번 주 루틴을 새로 만들까요? 이미 완료한 기록은 그대로 남아요.";

export function CardioContent() {
  const { user } = useAuth();
  const profileData = useSyncExternalStore(
    subscribeProfile,
    getProfileSnapshot,
    getProfileServerSnapshot,
  );
  const localWeek = useLocalWeek();

  const profile = profileData?.profile ?? null;
  const cardioEnabled = Boolean(profile && profile.cardioIntensity !== "none");
  const weekStartDate =
    cardioEnabled && localWeek ? localWeek.weekStartDate : undefined;

  const {
    status,
    plan,
    cardioLogs,
    error,
    saving,
    generate,
    toggleCompletion,
  } = useCardioPlan(user?.uid, weekStartDate);

  const [showRegenerateForm, setShowRegenerateForm] = useState(false);
  const [freeWalkOpen, setFreeWalkOpen] = useState(false);

  const targetCount = profile ? getCardioTargetCount(profile.cardioIntensity) : 0;

  const handleGenerate = async (settings: CardioSettings) => {
    if (!profile || !weekStartDate) {
      return;
    }
    const result = await generate({
      weekStartDate,
      cardioIntensity: profile.cardioIntensity,
      activityLevel: profile.activityLevel,
      settings,
    });
    if (result.ok) {
      setShowRegenerateForm(false);
    }
  };

  const handleRegenerateClick = () => {
    if (window.confirm(REGENERATE_CONFIRM)) {
      setShowRegenerateForm(true);
    }
  };

  const isCompleted = (session: CardioSession): boolean => {
    const log = cardioLogs[session.date];
    return Boolean(
      log && log.completed && log.plannedSessionId === session.id,
    );
  };

  const renderBody = () => {
    if (!localWeek) {
      return (
        <div className="rounded-3xl border border-gakk-sage/40 bg-white p-5 text-sm text-gakk-text-muted">
          불러오는 중이에요...
        </div>
      );
    }

    if (!profile) {
      return (
        <div className="rounded-3xl border border-gakk-sage/40 bg-white p-5">
          <p className="text-sm text-gakk-text">
            프로필을 설정하면 이번 주 유산소 계획을 만들 수 있어요.
          </p>
          <Link
            href="/onboarding"
            className="mt-3 inline-block text-sm font-medium text-gakk-mint underline"
          >
            프로필 설정하러 가기
          </Link>
        </div>
      );
    }

    if (profile.cardioIntensity === "none") {
      return (
        <div className="space-y-4">
          <div className="rounded-3xl border border-gakk-sage/40 bg-white p-5">
            <p className="text-sm font-semibold text-gakk-text">
              이번 주에는 설정된 유산소 계획이 없어요.
            </p>
            <p className="mt-2 text-sm text-gakk-text-muted">
              운동 빈도를 바꾸려면 프로필 설정에서 변경할 수 있어요.
            </p>
            <Link
              href="/onboarding"
              className="mt-3 inline-block text-sm font-medium text-gakk-mint underline"
            >
              프로필 설정으로 이동
            </Link>
          </div>

          <div className="rounded-3xl border border-gakk-sage/40 bg-white p-5">
            <button
              type="button"
              onClick={() => setFreeWalkOpen((prev) => !prev)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-sm font-medium text-gakk-text">
                가볍게 걷고 싶은 날엔
              </span>
              <span className="text-xs text-gakk-text-muted">
                {freeWalkOpen ? "접기" : "보기"}
              </span>
            </button>
            {freeWalkOpen ? (
              <p className="mt-3 text-sm leading-relaxed text-gakk-text-muted">
                계획 없이도 식후 10~20분 정도 동네를 천천히 걷는 것만으로
                충분해요. 편한 신발로, 대화할 수 있는 속도면 좋아요. 이 안내는
                자유 활동이라 완료 기록에는 포함되지 않아요.
              </p>
            ) : null}
          </div>
        </div>
      );
    }

    if (status === "loading") {
      return (
        <div className="rounded-3xl border border-gakk-sage/40 bg-white p-5 text-sm text-gakk-text-muted">
          이번 주 계획을 불러오는 중이에요...
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-600">
          {error ?? "문제가 생겼어요. 잠시 후 다시 시도해 주세요."}
        </div>
      );
    }

    if (status === "empty" || (showRegenerateForm && plan)) {
      return (
        <div className="space-y-4">
          <div className="rounded-3xl border border-gakk-sage/40 bg-white p-5">
            <p className="text-sm font-semibold text-gakk-text">
              주 {targetCount}회 ·{" "}
              {getCardioIntensityLabel(profile.cardioIntensity)} 계획
            </p>
            <p className="mt-1 text-xs text-gakk-text-muted">
              선택한 요일 안에서 간격을 넓혀 규칙적으로 배치해요.
            </p>
          </div>

          <CardioSetupForm
            targetCount={targetCount}
            defaultSettings={plan?.settings}
            saving={saving}
            submitLabel={plan ? "루틴 다시 만들기" : "이번 주 루틴 만들기"}
            onSubmit={handleGenerate}
          />

          {showRegenerateForm ? (
            <button
              type="button"
              onClick={() => setShowRegenerateForm(false)}
              className="w-full text-center text-sm text-gakk-text-muted"
            >
              취소하고 기존 계획 유지
            </button>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          ) : null}
        </div>
      );
    }

    if (!plan) {
      return null;
    }

    const todaySession = plan.sessions.find(
      (session) => session.date === localWeek.today,
    );

    return (
      <div className="space-y-4">
        {todaySession ? (
          <div className="rounded-3xl border border-gakk-sage/40 bg-gakk-lime/20 p-5 shadow-sm">
            <p className="text-sm font-semibold text-gakk-text">오늘의 유산소</p>
            <p className="mt-2 text-2xl font-bold text-gakk-text">
              {CARDIO_TYPE_LABELS[todaySession.type]} {todaySession.durationMin}분
            </p>
            <p className="mt-1 text-sm text-gakk-text-muted">
              {CARDIO_INTENSITY_SESSION_LABELS[todaySession.intensity]} ·{" "}
              {todaySession.note}
            </p>
            <label className="mt-4 flex items-center gap-3">
              <input
                type="checkbox"
                checked={isCompleted(todaySession)}
                onChange={(event) =>
                  toggleCompletion(todaySession, event.target.checked)
                }
                className="h-5 w-5 rounded accent-gakk-mint"
              />
              <span className="text-sm font-medium text-gakk-text">
                오늘 유산소 완료
              </span>
            </label>
          </div>
        ) : (
          <div className="rounded-3xl border border-gakk-sage/40 bg-white p-5">
            <p className="text-sm text-gakk-text-muted">
              오늘은 쉬는 날이에요. 가볍게 스트레칭만 해도 충분해요.
            </p>
          </div>
        )}

        <div className="rounded-3xl border border-gakk-sage/40 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-gakk-text">이번 주 루틴</p>
          <ul className="mt-4 space-y-3">
            {plan.sessions.map((session) => {
              const completed = isCompleted(session);
              return (
                <li
                  key={session.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-gakk-cream px-4 py-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gakk-text">
                      {session.dayLabel}요일 ·{" "}
                      {CARDIO_TYPE_LABELS[session.type]} {session.durationMin}분
                    </p>
                    <p className="mt-0.5 text-xs text-gakk-text-muted">
                      {CARDIO_INTENSITY_SESSION_LABELS[session.intensity]} ·{" "}
                      {session.note}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={completed}
                    onChange={(event) =>
                      toggleCompletion(session, event.target.checked)
                    }
                    aria-label={`${session.dayLabel}요일 완료`}
                    className="h-5 w-5 shrink-0 rounded accent-gakk-mint"
                  />
                </li>
              );
            })}
          </ul>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleRegenerateClick}
          className="w-full rounded-2xl border border-gakk-sage/50 bg-white py-3 text-sm font-medium text-gakk-text"
        >
          루틴 다시 만들기
        </button>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="유산소"
        subtitle="내 일정에 맞춰, 무리하지 않는 규칙 기반 루틴이에요."
      />
      <div className="space-y-4 px-5 py-5">{renderBody()}</div>
    </>
  );
}
