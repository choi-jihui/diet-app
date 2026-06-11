"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { InstantFridgeResultCard } from "@/components/instant/InstantResultCards";
import { PillSelect } from "@/components/ui/PillSelect";
import {
  COOKING_TIME_OPTIONS,
  HUNGER_LEVEL_OPTIONS,
  MEAL_STYLE_OPTIONS,
} from "@/constants/instant";
import { MEAL_SLOT_OPTIONS } from "@/constants/meal-slots";
import { useAuth } from "@/lib/auth/useAuth";
import { useIngredients } from "@/hooks/useIngredients";
import { useInstantRecommendation } from "@/hooks/useInstantRecommendation";
import type { HungerLevel, MaxPrepMinutes, MealStyle } from "@/types/instant";
import type { MealSlot } from "@/types/user";

export function FridgeModeForm() {
  const { user } = useAuth();
  const { items, status: ingredientsStatus, error: ingredientsError } = useIngredients(
    user?.uid,
  );
  const { fridgeState, recommendFridge, clearFridgeState } = useInstantRecommendation();
  const [mealSlot, setMealSlot] = useState<MealSlot>("lunch");
  const [preferredIngredients, setPreferredIngredients] = useState<string[]>([]);
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);
  const [hungerLevel, setHungerLevel] = useState<HungerLevel>("normal");
  const [maxPrepMinutes, setMaxPrepMinutes] = useState<MaxPrepMinutes>(20);
  const [style, setStyle] = useState<MealStyle>("filling");

  const ingredientNames = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.name.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "ko"),
      ),
    [items],
  );

  const canRecommend = ingredientsStatus === "ready" && ingredientNames.length > 0;

  const togglePreferred = (name: string) => {
    setPreferredIngredients((prev) => {
      if (prev.includes(name)) {
        return prev.filter((value) => value !== name);
      }
      return [...prev, name];
    });
    setExcludedIngredients((prev) => prev.filter((value) => value !== name));
  };

  const toggleExcluded = (name: string) => {
    setExcludedIngredients((prev) => {
      if (prev.includes(name)) {
        return prev.filter((value) => value !== name);
      }
      return [...prev, name];
    });
    setPreferredIngredients((prev) => prev.filter((value) => value !== name));
  };

  const handleRecommend = async () => {
    if (!canRecommend || fridgeState.status === "loading") {
      return;
    }

    await recommendFridge({
      mealSlot,
      preferredIngredients,
      excludedIngredients,
      hungerLevel,
      maxPrepMinutes,
      style,
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

      <div className="rounded-2xl border border-gakk-sage/40 bg-white px-3.5 py-3">
        <p className="text-sm font-medium text-gakk-text">냉장고 재료 선택</p>
        <p className="mt-1 text-xs text-gakk-text-muted">
          선호/제외 재료는 냉장고에 등록된 항목만 선택할 수 있어요.
        </p>

        {ingredientsStatus === "loading" ? (
          <p className="mt-3 text-sm text-gakk-text-muted">냉장고 재료를 불러오는 중이에요...</p>
        ) : null}

        {ingredientsStatus === "error" ? (
          <p className="mt-3 text-sm text-red-500">
            {ingredientsError ?? "재료를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."}
          </p>
        ) : null}

        {ingredientsStatus === "ready" && ingredientNames.length === 0 ? (
          <div className="mt-3 rounded-xl bg-gakk-cream px-3 py-3 text-sm text-gakk-text-muted">
            냉장고 재료가 아직 없어요.{" "}
            <Link href="/fridge" className="font-medium text-gakk-mint underline">
              재료 먼저 추가하기
            </Link>
          </div>
        ) : null}

        {ingredientNames.length > 0 ? (
          <div className="mt-3 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gakk-text-muted">선호 재료</p>
              <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
                {ingredientNames.map((name) => (
                  <button
                    key={`prefer-${name}`}
                    type="button"
                    onClick={() => togglePreferred(name)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      preferredIngredients.includes(name)
                        ? "bg-gakk-mint text-white"
                        : "bg-gakk-cream text-gakk-text-muted"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gakk-text-muted">제외 재료</p>
              <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
                {ingredientNames.map((name) => (
                  <button
                    key={`exclude-${name}`}
                    type="button"
                    onClick={() => toggleExcluded(name)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      excludedIngredients.includes(name)
                        ? "bg-red-100 text-red-600"
                        : "bg-gakk-cream text-gakk-text-muted"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
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
        value={maxPrepMinutes}
        onChange={setMaxPrepMinutes}
      />

      <PillSelect
        label="원하는 스타일"
        options={MEAL_STYLE_OPTIONS}
        value={style}
        onChange={setStyle}
      />

      <button
        type="button"
        onClick={handleRecommend}
        disabled={!canRecommend || fridgeState.status === "loading"}
        className={`w-full rounded-2xl py-3 text-sm font-semibold text-white ${
          !canRecommend || fridgeState.status === "loading"
            ? "bg-gakk-mint/40"
            : "bg-gakk-mint"
        }`}
      >
        {fridgeState.status === "loading" ? "추천 만드는 중..." : "추천 받기"}
      </button>

      {fridgeState.status === "error" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {fridgeState.error}
        </div>
      ) : null}

      {fridgeState.status === "success" && fridgeState.data?.length ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gakk-text">추천 3가지</p>
            <button
              type="button"
              onClick={clearFridgeState}
              className="text-xs text-gakk-text-muted"
            >
              결과 지우기
            </button>
          </div>
          {fridgeState.data.map((item, index) => (
            <InstantFridgeResultCard key={`${item.title}-${index}`} item={item} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
