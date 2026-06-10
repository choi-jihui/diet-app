"use client";

import { useSyncExternalStore, useState } from "react";
import { DEFAULT_MEAL_SLOTS } from "@/constants/meal-slots";
import {
  getMockPlannedMeals,
  getMockMealLabel,
  type MockPlannedMeal,
} from "@/constants/mock-meals";
import {
  getProfileServerSnapshot,
  getProfileSnapshot,
  subscribeProfile,
} from "@/lib/storage/profile-storage";
import type { MealSlot } from "@/types/user";

interface MealCardState {
  ateAsPlanned: boolean;
  showCustomInput: boolean;
  customNote: string;
}

function PlannedMealCard({
  meal,
  state,
  onToggleAte,
  onToggleCustom,
  onCustomNoteChange,
}: {
  meal: MockPlannedMeal;
  state: MealCardState;
  onToggleAte: () => void;
  onToggleCustom: () => void;
  onCustomNoteChange: (value: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-gakk-sage/40 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-gakk-text">{getMockMealLabel(meal)}</p>
      <p className="mt-1 text-xs text-gakk-text-muted">
        예상 {meal.estimatedCalories} kcal
      </p>

      <label className="mt-4 flex items-center gap-3">
        <input
          type="checkbox"
          checked={state.ateAsPlanned}
          onChange={onToggleAte}
          className="h-5 w-5 rounded accent-gakk-coral"
        />
        <span className="text-sm font-medium text-gakk-text">계획대로 먹었어요</span>
      </label>

      <button
        type="button"
        onClick={onToggleCustom}
        className="mt-3 text-sm font-medium text-gakk-mint"
      >
        {state.showCustomInput ? "직접 입력 닫기" : "다르게 먹었어요"}
      </button>

      {state.showCustomInput ? (
        <textarea
          value={state.customNote}
          onChange={(event) => onCustomNoteChange(event.target.value)}
          placeholder="예: 샐러드 대신 김밥"
          rows={2}
          className="mt-3 w-full resize-none rounded-2xl border border-gakk-sage/50 bg-gakk-cream px-4 py-3 text-sm text-gakk-text placeholder:text-gakk-text-muted/60 focus:outline-none focus:ring-2 focus:ring-gakk-mint/40"
        />
      ) : null}
    </div>
  );
}

function LogMealChecklistInner({ meals }: { meals: MockPlannedMeal[] }) {
  const [mealStates, setMealStates] = useState<Record<string, MealCardState>>(() =>
    Object.fromEntries(
      meals.map((meal) => [
        meal.slot,
        { ateAsPlanned: false, showCustomInput: false, customNote: "" },
      ]),
    ),
  );

  const updateMealState = (
    slot: MealSlot,
    updater: (current: MealCardState) => MealCardState,
  ) => {
    setMealStates((prev) => ({
      ...prev,
      [slot]: updater(
        prev[slot] ?? {
          ateAsPlanned: false,
          showCustomInput: false,
          customNote: "",
        },
      ),
    }));
  };

  return (
    <>
      {meals.map((meal) => (
        <PlannedMealCard
          key={meal.slot}
          meal={meal}
          state={
            mealStates[meal.slot] ?? {
              ateAsPlanned: false,
              showCustomInput: false,
              customNote: "",
            }
          }
          onToggleAte={() =>
            updateMealState(meal.slot, (current) => ({
              ...current,
              ateAsPlanned: !current.ateAsPlanned,
            }))
          }
          onToggleCustom={() =>
            updateMealState(meal.slot, (current) => ({
              ...current,
              showCustomInput: !current.showCustomInput,
            }))
          }
          onCustomNoteChange={(value) =>
            updateMealState(meal.slot, (current) => ({
              ...current,
              customNote: value,
            }))
          }
        />
      ))}
    </>
  );
}

export function LogMealChecklist() {
  const data = useSyncExternalStore(
    subscribeProfile,
    getProfileSnapshot,
    getProfileServerSnapshot,
  );
  const slots = data?.profile.selectedMealSlots ?? DEFAULT_MEAL_SLOTS;
  const meals = getMockPlannedMeals(slots);
  const slotKey = slots.join("-");

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-gakk-text">계획된 식단</p>
      <LogMealChecklistInner key={slotKey} meals={meals} />
    </div>
  );
}
