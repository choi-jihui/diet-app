"use client";

import { useState } from "react";
import { InstantDiningResultCard } from "@/components/instant/InstantResultCards";
import { PillSelect } from "@/components/ui/PillSelect";
import {
  DINING_CATEGORY_OPTIONS,
  HUNGER_LEVEL_OPTIONS,
  type DiningCategory,
} from "@/constants/instant";
import { MEAL_SLOT_OPTIONS } from "@/constants/meal-slots";
import { useInstantRecommendation } from "@/hooks/useInstantRecommendation";
import type { HungerLevel } from "@/types/instant";
import type { MealSlot } from "@/types/user";

const inputClassName =
  "mt-2 w-full rounded-xl border border-gakk-sage/50 bg-gakk-cream px-3.5 py-2.5 text-sm text-gakk-text placeholder:text-gakk-text-muted/60 focus:outline-none focus:ring-2 focus:ring-gakk-mint/30";

interface DiningModeFormProps {
  remainingCalories?: number;
}

export function DiningModeForm({ remainingCalories }: DiningModeFormProps) {
  const { diningState, recommendDining, clearDiningState } = useInstantRecommendation();
  const [mealSlot, setMealSlot] = useState<MealSlot>("lunch");
  const [category, setCategory] = useState<DiningCategory>("한식");
  const [customCategory, setCustomCategory] = useState("");
  const [candidateMenusText, setCandidateMenusText] = useState("");
  const [budget, setBudget] = useState("");
  const [hungerLevel, setHungerLevel] = useState<HungerLevel>("normal");

  const handleRecommend = async () => {
    if (diningState.status === "loading") {
      return;
    }
    const categoryValue =
      category === "직접 입력" ? customCategory.trim() : category;

    if (!categoryValue) {
      return;
    }

    const candidateMenus = Array.from(
      new Set(
        candidateMenusText
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );

    await recommendDining({
      mealSlot,
      category: categoryValue,
      candidateMenus,
      budgetText: budget.trim() || undefined,
      hungerLevel,
      remainingCalories,
    });
  };

  return (
    <div className="space-y-5">
      <PillSelect
        label="끼니"
        options={MEAL_SLOT_OPTIONS}
        value={mealSlot}
        onChange={setMealSlot}
      />

      <div>
        <p className="text-sm font-medium text-gakk-text">카테고리</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DINING_CATEGORY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setCategory(option)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
                category === option
                  ? "bg-gakk-mint text-white"
                  : "bg-gakk-cream text-gakk-text-muted"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {category === "직접 입력" ? (
        <div>
          <label htmlFor="custom-category" className="text-sm font-medium text-gakk-text">
            카테고리 직접 입력
          </label>
          <input
            id="custom-category"
            value={customCategory}
            onChange={(event) => setCustomCategory(event.target.value)}
            placeholder="예: 샐러드 전문점"
            className={inputClassName}
          />
        </div>
      ) : null}

      <div>
        <label htmlFor="menu-consideration" className="text-sm font-medium text-gakk-text">
          후보 메뉴 <span className="text-gakk-text-muted">(쉼표로 구분)</span>
        </label>
        <input
          id="menu-consideration"
          value={candidateMenusText}
          onChange={(event) => setCandidateMenusText(event.target.value)}
          placeholder="예: 김치찌개, 비빔밥"
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="budget" className="text-sm font-medium text-gakk-text">
          예산 <span className="text-gakk-text-muted">(선택)</span>
        </label>
        <input
          id="budget"
          type="number"
          inputMode="numeric"
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
          placeholder="예: 12000"
          className={inputClassName}
        />
      </div>

      <PillSelect
        label="배고픔 정도"
        options={HUNGER_LEVEL_OPTIONS}
        value={hungerLevel}
        onChange={setHungerLevel}
      />

      <div>
        <label htmlFor="remaining-calories" className="text-sm font-medium text-gakk-text">
          오늘 남은 목표 칼로리
        </label>
        <input
          id="remaining-calories"
          readOnly
          value={
            remainingCalories !== undefined
              ? `${remainingCalories} kcal`
              : "프로필 설정 후 표시됩니다"
          }
          className={`${inputClassName} text-gakk-text-muted`}
        />
      </div>

      <button
        type="button"
        onClick={handleRecommend}
        disabled={diningState.status === "loading"}
        className={`w-full rounded-2xl py-3 text-sm font-semibold text-white ${
          diningState.status === "loading" ? "bg-gakk-mint/40" : "bg-gakk-mint"
        }`}
      >
        {diningState.status === "loading" ? "추천 만드는 중..." : "추천 받기"}
      </button>

      {diningState.status === "error" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {diningState.error}
        </div>
      ) : null}

      {diningState.status === "success" && diningState.data?.length ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gakk-text">추천 3가지</p>
            <button
              type="button"
              onClick={clearDiningState}
              className="text-xs text-gakk-text-muted"
            >
              결과 지우기
            </button>
          </div>
          {diningState.data.map((item, index) => (
            <InstantDiningResultCard key={`${item.menuName}-${index}`} item={item} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
