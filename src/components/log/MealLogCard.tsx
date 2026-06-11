"use client";

import { useState } from "react";
import {
  FOOD_CALORIES_MAX,
  FOOD_PROTEIN_MAX_G,
  type CustomFoodEntry,
  type MealLog,
} from "@/types/daily-log";
import type { MealOption, MealSlotType, PlannedMeal } from "@/types/meal";

const OPTION_LABELS: Record<string, string> = {
  fat_loss: "감량형",
  filling: "든든형",
  lazy: "간단형",
};

const inputClassName =
  "w-full rounded-xl border border-gakk-sage/50 bg-gakk-cream px-3 py-2 text-sm text-gakk-text placeholder:text-gakk-text-muted/60 focus:outline-none focus:ring-2 focus:ring-gakk-mint/30";

interface MealLogCardProps {
  slot: MealSlotType;
  slotLabel: string;
  plannedMeal?: PlannedMeal;
  mealLog?: MealLog;
  onSave: (mealLog: MealLog | null) => void;
}

interface EntryDraft {
  name: string;
  calories: string;
  proteinG: string;
}

const EMPTY_DRAFT: EntryDraft = { name: "", calories: "", proteinG: "" };

function parseDraft(draft: EntryDraft): CustomFoodEntry | null {
  const name = draft.name.trim();
  const calories = Number(draft.calories);
  if (
    !name ||
    !Number.isFinite(calories) ||
    calories < 0 ||
    calories > FOOD_CALORIES_MAX
  ) {
    return null;
  }

  const entry: CustomFoodEntry = {
    id: crypto.randomUUID(),
    name,
    calories: Math.round(calories),
  };

  if (draft.proteinG.trim() !== "") {
    const protein = Number(draft.proteinG);
    if (!Number.isFinite(protein) || protein < 0 || protein > FOOD_PROTEIN_MAX_G) {
      return null;
    }
    entry.proteinG = Math.round(protein * 10) / 10;
  }

  return entry;
}

export function MealLogCard({
  slot,
  slotLabel,
  plannedMeal,
  mealLog,
  onSave,
}: MealLogCardProps) {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [draft, setDraft] = useState<EntryDraft>(EMPTY_DRAFT);
  const [draftError, setDraftError] = useState<string | null>(null);

  const status = mealLog?.status ?? "unlogged";
  const customEntries = mealLog?.customEntries ?? [];

  const selectPlanned = (option: MealOption) => {
    onSave({
      slot,
      status: "planned",
      plannedOption: {
        optionType: option.type,
        title: option.title,
        estimatedCalories: option.estimatedCalories,
        estimatedProteinG: option.estimatedProteinG,
      },
    });
    setShowCustomForm(false);
  };

  const markSkipped = () => {
    onSave({ slot, status: "skipped" });
    setShowCustomForm(false);
  };

  const resetToUnlogged = () => {
    onSave(null);
    setShowCustomForm(false);
  };

  const addCustomEntry = () => {
    const entry = parseDraft(draft);
    if (!entry) {
      setDraftError(
        `음식명과 칼로리(0~${FOOD_CALORIES_MAX})를 확인해 주세요. 단백질은 0~${FOOD_PROTEIN_MAX_G}g까지 입력할 수 있어요.`,
      );
      return;
    }
    setDraftError(null);
    setDraft(EMPTY_DRAFT);
    onSave({
      slot,
      status: "custom",
      customEntries: [...customEntries, entry],
    });
  };

  const removeCustomEntry = (entryId: string) => {
    const nextEntries = customEntries.filter((entry) => entry.id !== entryId);
    if (nextEntries.length === 0) {
      // 빈 customEntries로 custom 상태 저장 금지 → 미기록으로 되돌림
      onSave(null);
      return;
    }
    onSave({ slot, status: "custom", customEntries: nextEntries });
  };

  return (
    <div className="rounded-2xl border border-gakk-sage/40 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gakk-text">{slotLabel}</p>
        {status !== "unlogged" ? (
          <button
            type="button"
            onClick={resetToUnlogged}
            className="text-xs text-gakk-text-muted underline"
          >
            미기록으로 되돌리기
          </button>
        ) : (
          <span className="text-xs text-gakk-text-muted">미기록</span>
        )}
      </div>

      {plannedMeal ? (
        <div className="mt-3 space-y-2">
          {plannedMeal.options.map((option) => {
            const selected =
              status === "planned" &&
              mealLog?.plannedOption?.optionType === option.type;
            return (
              <button
                key={option.type}
                type="button"
                onClick={() => selectPlanned(option)}
                className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm ${
                  selected
                    ? "border-gakk-mint bg-gakk-mint/10"
                    : "border-gakk-line bg-gakk-cream/60"
                }`}
              >
                <span
                  className={`h-4 w-4 shrink-0 rounded-full border ${
                    selected
                      ? "border-gakk-mint bg-gakk-mint"
                      : "border-gakk-sage/60 bg-white"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-gakk-text">
                    {OPTION_LABELS[option.type] ?? option.type} · {option.title}
                  </span>
                  <span className="ml-1 text-xs text-gakk-text-muted">
                    약 {option.estimatedCalories} kcal
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gakk-text-muted">
          이날은 계획된 식단이 없어요. 먹은 음식을 직접 기록해 주세요.
        </p>
      )}

      {status === "skipped" ? (
        <p className="mt-3 rounded-xl bg-gakk-cream px-3 py-2 text-xs text-gakk-text-muted">
          이 끼니는 먹지 않은 것으로 기록했어요.
        </p>
      ) : null}

      {customEntries.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {customEntries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-gakk-cream px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 text-gakk-text">
                {entry.name}
                <span className="ml-1 text-xs text-gakk-text-muted">
                  약 {entry.calories} kcal
                  {typeof entry.proteinG === "number"
                    ? ` · 단백질 ${entry.proteinG}g`
                    : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeCustomEntry(entry.id)}
                className="shrink-0 text-xs text-gakk-text-muted underline"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setShowCustomForm((prev) => !prev)}
          className="flex-1 rounded-xl border border-gakk-sage/50 bg-white py-2 text-xs font-medium text-gakk-text"
        >
          {showCustomForm ? "입력 닫기" : "다르게 먹었어요"}
        </button>
        {status !== "skipped" ? (
          <button
            type="button"
            onClick={markSkipped}
            className="flex-1 rounded-xl border border-gakk-sage/50 bg-white py-2 text-xs font-medium text-gakk-text-muted"
          >
            먹지 않았어요
          </button>
        ) : null}
      </div>

      {showCustomForm ? (
        <div className="mt-3 space-y-2 rounded-xl border border-gakk-line bg-gakk-cream/50 p-3">
          <input
            value={draft.name}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder="음식명 (예: 김밥)"
            className={inputClassName}
          />
          <div className="flex gap-2">
            <input
              value={draft.calories}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, calories: event.target.value }))
              }
              type="number"
              inputMode="numeric"
              placeholder="칼로리 (필수)"
              className={inputClassName}
            />
            <input
              value={draft.proteinG}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, proteinG: event.target.value }))
              }
              type="number"
              inputMode="decimal"
              placeholder="단백질 g (선택)"
              className={inputClassName}
            />
          </div>
          <p className="text-xs text-gakk-text-muted">
            포장지나 메뉴 정보를 참고해 대략 입력해도 괜찮아요.
          </p>
          {draftError ? (
            <p className="text-xs text-gakk-coral">{draftError}</p>
          ) : null}
          <button
            type="button"
            onClick={addCustomEntry}
            className="w-full rounded-xl bg-gakk-mint py-2 text-xs font-semibold text-white"
          >
            음식 추가
          </button>
        </div>
      ) : null}
    </div>
  );
}
