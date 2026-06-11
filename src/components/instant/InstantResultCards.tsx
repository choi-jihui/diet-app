"use client";

import { useState } from "react";
import type {
  InstantDiningRecommendation,
  InstantFridgeRecommendation,
} from "@/types/instant";

interface FridgeResultCardProps {
  item: InstantFridgeRecommendation;
}

interface DiningResultCardProps {
  item: InstantDiningRecommendation;
}

export function InstantFridgeResultCard({ item }: FridgeResultCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-gakk-line bg-white px-3.5 py-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gakk-text">{item.title}</p>
          <p className="mt-1 text-xs text-gakk-text-muted">
            약 {item.estimatedCalories}kcal · 단백질 {item.estimatedProteinG}g · {item.prepMinutes}분
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-gakk-text-muted">{item.why}</p>
        </div>
        <span className="shrink-0 text-xs text-gakk-text-muted">{open ? "접기" : "자세히"}</span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-gakk-line pt-3">
          <div>
            <p className="text-xs font-semibold text-gakk-text-muted">재료</p>
            <ul className="mt-1 space-y-1">
              {item.ingredients.map((ingredient, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-gakk-text">
                  <span>
                    {ingredient.name}
                    {ingredient.amount ? ` ${ingredient.amount}` : ""}
                  </span>
                  <span className="text-xs text-gakk-text-muted">
                    {ingredient.fromFridge ? "냉장고" : "기본"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-gakk-text-muted">조리 순서</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4 text-sm text-gakk-text">
              {item.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function InstantDiningResultCard({ item }: DiningResultCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-gakk-line bg-white px-3.5 py-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gakk-text">{item.menuName}</p>
          <p className="mt-1 text-xs text-gakk-text-muted">
            {item.category} · 약 {item.estimatedCaloriesRange.min}~{item.estimatedCaloriesRange.max}
            kcal
            {typeof item.proteinEstimateG === "number"
              ? ` · 단백질 약 ${item.proteinEstimateG}g`
              : ""}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-gakk-text-muted">{item.why}</p>
        </div>
        <span className="shrink-0 text-xs text-gakk-text-muted">{open ? "접기" : "자세히"}</span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-gakk-line pt-3">
          <div>
            <p className="text-xs font-semibold text-gakk-text-muted">주문 팁</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-gakk-text">
              {item.orderTips.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-gakk-text-muted">양 조절 팁</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-gakk-text">
              {item.portionTips.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-gakk-cream px-3 py-2 text-xs text-gakk-text-muted">
            다음 끼니 균형 팁: {item.balanceTip}
          </div>
        </div>
      ) : null}
    </div>
  );
}
