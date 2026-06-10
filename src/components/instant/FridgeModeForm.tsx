"use client";

import { useState } from "react";
import { PillSelect } from "@/components/ui/PillSelect";
import {
  COOKING_TIME_OPTIONS,
  HUNGER_LEVEL_OPTIONS,
  MEAL_STYLE_OPTIONS,
} from "@/constants/instant";
import { MEAL_SLOT_OPTIONS } from "@/constants/meal-slots";
import type {
  CookingTimeBudget,
  HungerLevel,
  MealStyle,
} from "@/types/instant";
import type { MealSlot } from "@/types/user";

const inputClassName =
  "mt-2 w-full rounded-xl border border-gakk-sage/50 bg-gakk-cream px-3.5 py-2.5 text-sm text-gakk-text placeholder:text-gakk-text-muted/60 focus:outline-none focus:ring-2 focus:ring-gakk-mint/30";

export function FridgeModeForm() {
  const [mealSlot, setMealSlot] = useState<MealSlot>("lunch");
  const [wantedIngredients, setWantedIngredients] = useState("");
  const [excludedIngredients, setExcludedIngredients] = useState("");
  const [hungerLevel, setHungerLevel] = useState<HungerLevel>("normal");
  const [cookingTime, setCookingTime] = useState<CookingTimeBudget>("20min");
  const [mealStyle, setMealStyle] = useState<MealStyle>("filling");

  return (
    <div className="space-y-5">
      <PillSelect
        label="끼니"
        options={MEAL_SLOT_OPTIONS}
        value={mealSlot}
        onChange={setMealSlot}
      />

      <div>
        <label htmlFor="wanted-ingredients" className="text-sm font-medium text-gakk-text">
          먹고 싶은 재료
        </label>
        <textarea
          id="wanted-ingredients"
          value={wantedIngredients}
          onChange={(event) => setWantedIngredients(event.target.value)}
          placeholder="예: 참치, 바나나, 계란"
          rows={2}
          className={`${inputClassName} resize-none`}
        />
      </div>

      <div>
        <label htmlFor="excluded-ingredients" className="text-sm font-medium text-gakk-text">
          제외할 재료
        </label>
        <textarea
          id="excluded-ingredients"
          value={excludedIngredients}
          onChange={(event) => setExcludedIngredients(event.target.value)}
          placeholder="예: 양배추"
          rows={2}
          className={`${inputClassName} resize-none`}
        />
      </div>

      <PillSelect
        label="배고픔 정도"
        options={HUNGER_LEVEL_OPTIONS}
        value={hungerLevel}
        onChange={setHungerLevel}
      />

      <PillSelect
        label="조리 가능 시간"
        options={COOKING_TIME_OPTIONS}
        value={cookingTime}
        onChange={setCookingTime}
      />

      <PillSelect
        label="원하는 스타일"
        options={MEAL_STYLE_OPTIONS}
        value={mealStyle}
        onChange={setMealStyle}
      />

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
