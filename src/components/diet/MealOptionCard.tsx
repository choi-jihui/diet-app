"use client";

import { useState } from "react";
import type { MealOption, MealOptionType } from "@/types/meal";

const OPTION_LABELS: Record<MealOptionType, { label: string; tone: string }> = {
  fat_loss: { label: "감량형", tone: "bg-gakk-mint/15 text-gakk-mint" },
  filling: { label: "든든형", tone: "bg-gakk-lime/30 text-gakk-text" },
  lazy: { label: "귀찮은 날", tone: "bg-gakk-sage/40 text-gakk-text" },
};

export function MealOptionCard({ option }: { option: MealOption }) {
  const [open, setOpen] = useState(false);
  const meta = OPTION_LABELS[option.type];

  return (
    <div className="py-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.tone}`}
            >
              {meta.label}
            </span>
            <span className="truncate text-sm font-medium text-gakk-text">
              {option.title}
            </span>
          </div>
          <p className="mt-1 text-xs text-gakk-text-muted">
            약 {option.estimatedCalories}kcal · 단백질 {option.estimatedProteinG}g ·{" "}
            {option.prepMinutes}분
          </p>
        </div>
        <span className="shrink-0 pt-0.5 text-xs text-gakk-text-muted">
          {open ? "접기" : "자세히"}
        </span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-gakk-line pt-3">
          {option.ingredients.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-gakk-text-muted">재료</p>
              <ul className="mt-1 space-y-1">
                {option.ingredients.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-2 text-sm text-gakk-text"
                  >
                    <span>
                      {item.name}
                      {item.amount ? ` ${item.amount}` : ""}
                    </span>
                    {item.fromFridge ? (
                      <span className="text-xs text-gakk-mint">냉장고</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {option.steps.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-gakk-text-muted">조리법</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4 text-sm text-gakk-text">
                {option.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
          ) : null}

          {option.why ? (
            <p className="text-sm text-gakk-text-muted">{option.why}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
