"use client";

import { useState } from "react";
import { PillSelect } from "@/components/ui/PillSelect";
import {
  DINING_CATEGORY_OPTIONS,
  HUNGER_LEVEL_OPTIONS,
  type DiningCategory,
} from "@/constants/instant";
import type { HungerLevel } from "@/types/instant";

const inputClassName =
  "mt-2 w-full rounded-xl border border-gakk-sage/50 bg-gakk-cream px-3.5 py-2.5 text-sm text-gakk-text placeholder:text-gakk-text-muted/60 focus:outline-none focus:ring-2 focus:ring-gakk-mint/30";

interface DiningModeFormProps {
  remainingCalories?: number;
}

export function DiningModeForm({ remainingCalories }: DiningModeFormProps) {
  const [category, setCategory] = useState<DiningCategory>("한식");
  const [customCategory, setCustomCategory] = useState("");
  const [menuConsideration, setMenuConsideration] = useState("");
  const [budget, setBudget] = useState("");
  const [hungerLevel, setHungerLevel] = useState<HungerLevel>("normal");

  return (
    <div className="space-y-5">
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
          고민 중인 메뉴
        </label>
        <input
          id="menu-consideration"
          value={menuConsideration}
          onChange={(event) => setMenuConsideration(event.target.value)}
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
        disabled
        className="w-full rounded-2xl bg-gakk-mint/40 py-3 text-sm font-semibold text-white"
      >
        추천 받기
      </button>
    </div>
  );
}
