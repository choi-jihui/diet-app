"use client";

import { useState } from "react";
import { SUPPORTIVE_COPY } from "@/constants/copy";
import type { NutritionTargets } from "@/types/nutrition";

interface CalorieHeroCardProps {
  targets: NutritionTargets;
}

export function CalorieHeroCard({ targets }: CalorieHeroCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const detailItems = [
    { label: "기초대사량", value: `${targets.bmr} kcal` },
    { label: "하루 소모 추정", value: `${targets.tdee} kcal` },
    { label: "단백질 목표", value: `${targets.proteinGoalG} g` },
    { label: "물 목표", value: `${targets.waterGoalMl} ml` },
  ];

  return (
    <section className="rounded-2xl border border-gakk-line bg-white p-4">
      <p className="text-sm text-gakk-text-muted">오늘 목표 칼로리</p>
      <p className="mt-1 text-3xl font-bold text-gakk-mint">
        {targets.targetCalories}
        <span className="ml-1 text-base font-medium text-gakk-text-muted">kcal</span>
      </p>
      <p className="mt-2 text-sm text-gakk-text-muted">{SUPPORTIVE_COPY.nextMealTip}</p>

      <button
        type="button"
        onClick={() => setShowDetails((prev) => !prev)}
        className="mt-3 text-sm font-medium text-gakk-mint"
        aria-expanded={showDetails}
      >
        {showDetails ? "접기" : "자세히 보기 →"}
      </button>

      {showDetails ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gakk-line pt-3">
          {detailItems.map((item) => (
            <div key={item.label}>
              <dt className="text-xs text-gakk-text-muted">{item.label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-gakk-text">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
