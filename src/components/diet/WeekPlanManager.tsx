"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { MealOptionCard } from "@/components/diet/MealOptionCard";
import { useIngredients } from "@/hooks/useIngredients";
import { useWeeklyPlan } from "@/hooks/useWeeklyPlan";
import { useAuth } from "@/lib/auth/useAuth";
import { MEAL_SLOT_LABELS_KO } from "@/lib/ai/calorie-allocation";
import {
  getProfileServerSnapshot,
  getProfileSnapshot,
  subscribeProfile,
} from "@/lib/storage/profile-storage";
import { buildWeekDates, getWeekStartDate } from "@/lib/utils/date";

interface WeekPlanManagerProps {
  onGoToFridge: () => void;
}

export function WeekPlanManager({ onGoToFridge }: WeekPlanManagerProps) {
  const { user } = useAuth();
  const profileData = useSyncExternalStore(
    subscribeProfile,
    getProfileSnapshot,
    getProfileServerSnapshot,
  );

  const weekStartDate = useMemo(() => getWeekStartDate(), []);
  const weekDates = useMemo(() => buildWeekDates(weekStartDate), [weekStartDate]);

  const ingredients = useIngredients(user?.uid);
  const {
    plan,
    draftPlan,
    status,
    error,
    generatingProgress,
    generate,
    reload,
  } = useWeeklyPlan(user?.uid, weekStartDate);

  const [selectedDay, setSelectedDay] = useState(0);
  const [userPickedDay, setUserPickedDay] = useState(false);

  const isGenerating = status === "generating";
  const displayPlan =
    isGenerating && draftPlan ? draftPlan : plan;

  const ingredientCount = ingredients.items.length;
  const isBusyLoading =
    ingredients.status === "loading" || status === "loading";

  const handleGenerate = () => {
    if (!profileData) {
      return;
    }
    if (!userPickedDay) {
      setSelectedDay(0);
    }
    generate({
      userProfile: profileData.profile,
      nutritionTargets: profileData.targets,
      ingredients: ingredients.items.map((item) => ({
        name: item.name,
        quantityText: item.quantityText,
      })),
    });
  };

  const handleRegenerate = () => {
    const confirmed = window.confirm(
      "이번 주 식단을 다시 만들까요? 기존 식단은 새로운 식단으로 교체돼요.",
    );
    if (confirmed) {
      handleGenerate();
    }
  };

  if (isBusyLoading) {
    return (
      <p className="px-1 py-8 text-center text-sm text-gakk-text-muted">
        불러오는 중...
      </p>
    );
  }

  if (status === "error" && !plan) {
    return (
      <div className="rounded-2xl border border-gakk-line bg-white p-6 text-center">
        <p className="text-sm text-gakk-text-muted">
          {error ?? "식단을 불러오지 못했어요."}
        </p>
        <button
          type="button"
          onClick={() => void reload()}
          className="mt-3 rounded-2xl bg-gakk-mint px-5 py-2 text-sm font-semibold text-white"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!displayPlan) {
    return (
      <div className="rounded-2xl border border-gakk-line bg-white p-6 text-center">
        <p className="text-sm font-medium text-gakk-text">
          냉장고 재료를 바탕으로 이번 주 식단을 만들어볼까요?
        </p>
        {ingredientCount === 0 ? (
          <>
            <p className="mt-2 text-xs text-gakk-text-muted">
              먼저 냉장고에 재료를 추가해 주세요.
            </p>
            <button
              type="button"
              onClick={onGoToFridge}
              className="mt-3 rounded-2xl bg-gakk-mint px-5 py-2 text-sm font-semibold text-white"
            >
              냉장고 재료 추가하기
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!profileData}
            className="mt-3 rounded-2xl bg-gakk-mint px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            이번 주 식단 만들기
          </button>
        )}
        {error ? <p className="mt-3 text-sm text-gakk-coral">{error}</p> : null}
      </div>
    );
  }

  const currentDay = displayPlan.dailyPlans[selectedDay];
  const progress = generatingProgress;

  return (
    <div className="space-y-4">
      {isGenerating && progress ? (
        <div className="rounded-2xl border border-gakk-mint/30 bg-gakk-primary-soft px-4 py-3">
          <p className="text-sm font-medium text-gakk-mint">
            {progress.completed < progress.total
              ? `${progress.completed}/${progress.total}일 완료 · ${progress.currentLabel} 준비 중`
              : "장보기 목록 정리 중"}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-gakk-mint transition-all duration-500"
              style={{
                width: `${Math.round((progress.completed / progress.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {weekDates.map((entry, index) => {
          const isActive = index === selectedDay;
          const isReady = Boolean(displayPlan.dailyPlans[index]);
          const isPending =
            isGenerating &&
            !isReady &&
            progress?.completed === index;

          return (
            <button
              key={entry.date}
              type="button"
              disabled={!isReady && !isPending}
              onClick={() => {
                if (isReady) {
                  setSelectedDay(index);
                  setUserPickedDay(true);
                }
              }}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                isActive && isReady
                  ? "bg-gakk-mint text-white"
                  : isReady
                    ? "border border-gakk-line bg-white text-gakk-text-muted"
                    : isPending
                      ? "border border-gakk-mint/50 bg-gakk-primary-soft text-gakk-mint animate-pulse"
                      : "border border-gakk-line bg-gakk-cream text-gakk-text-muted/50"
              }`}
            >
              {entry.dayLabel}
            </button>
          );
        })}
      </div>

      {currentDay ? (
        <>
          {currentDay.meals.map((meal) => (
            <section
              key={meal.mealType}
              className="rounded-2xl border border-gakk-line bg-white px-4 py-3"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-gakk-text">
                  {MEAL_SLOT_LABELS_KO[meal.mealType]}
                </h2>
                <span className="text-xs text-gakk-text-muted">
                  약 {meal.targetCalories}kcal
                </span>
              </div>
              <div className="mt-1 divide-y divide-gakk-line">
                {meal.options.map((option) => (
                  <MealOptionCard key={option.type} option={option} />
                ))}
              </div>
            </section>
          ))}

          {currentDay.coachNote ? (
            <p className="px-1 text-sm text-gakk-text-muted">
              {currentDay.coachNote}
            </p>
          ) : null}
        </>
      ) : (
        <div className="rounded-2xl border border-gakk-line bg-white px-4 py-8 text-center">
          <p className="text-sm text-gakk-text-muted">
            {isGenerating ? "이 날 식단을 준비하고 있어요..." : "식단이 없어요."}
          </p>
        </div>
      )}

      {!isGenerating && displayPlan.shoppingSuggestions.length > 0 ? (
        <section className="rounded-2xl border border-gakk-line bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-gakk-text">
            추가로 있으면 좋은 재료
          </h2>
          <ul className="mt-2 divide-y divide-gakk-line">
            {displayPlan.shoppingSuggestions.map((item, index) => (
              <li key={index} className="flex items-start gap-2 py-2">
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    item.priority === "recommended"
                      ? "bg-gakk-mint/15 text-gakk-mint"
                      : "bg-gakk-sage/40 text-gakk-text-muted"
                  }`}
                >
                  {item.priority === "recommended" ? "추천" : "선택"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gakk-text">{item.name}</p>
                  <p className="text-xs text-gakk-text-muted">{item.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {displayPlan.safetyNote ? (
        <div className="rounded-2xl bg-gakk-cream px-4 py-3">
          <p className="text-xs text-gakk-text-muted">
            비관리 끼니 여유: 약 {displayPlan.unmanagedMealCalories.min}~
            {displayPlan.unmanagedMealCalories.max}kcal ·{" "}
            {displayPlan.unmanagedMealCalories.note}
          </p>
          <p className="mt-1 text-xs text-gakk-text-muted">{displayPlan.safetyNote}</p>
          <p className="mt-1 text-xs text-gakk-text-muted">
            칼로리와 단백질은 추정치예요.
          </p>
        </div>
      ) : null}

      {error ? <p className="px-1 text-sm text-gakk-coral">{error}</p> : null}

      {!isGenerating ? (
        <button
          type="button"
          onClick={handleRegenerate}
          className="w-full rounded-2xl border border-gakk-line py-2.5 text-sm font-semibold text-gakk-text-muted"
        >
          이번 주 식단 다시 만들기
        </button>
      ) : null}
    </div>
  );
}
