"use client";

import { useState } from "react";
import {
  FOOD_CALORIES_MAX,
  FOOD_PROTEIN_MAX_G,
  type FoodCategory,
  type FoodEntry,
} from "@/types/daily-log";

const CATEGORY_OPTIONS: { value: FoodCategory; label: string }[] = [
  { value: "breakfast", label: "아침" },
  { value: "lunch", label: "점심" },
  { value: "dinner", label: "저녁" },
  { value: "snack", label: "간식" },
  { value: "drink", label: "음료" },
];

function categoryLabel(category: FoodCategory): string {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category;
}

const inputClassName =
  "w-full rounded-xl border border-gakk-sage/50 bg-gakk-cream px-3 py-2 text-sm text-gakk-text placeholder:text-gakk-text-muted/60 focus:outline-none focus:ring-2 focus:ring-gakk-mint/30";

interface ExtraFoodListProps {
  foods: FoodEntry[];
  onSave: (foods: FoodEntry[]) => void;
}

interface Draft {
  category: FoodCategory;
  name: string;
  calories: string;
  proteinG: string;
}

const EMPTY_DRAFT: Draft = {
  category: "snack",
  name: "",
  calories: "",
  proteinG: "",
};

function parseDraft(draft: Draft, existingId?: string): FoodEntry | null {
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

  const entry: FoodEntry = {
    id: existingId ?? crypto.randomUUID(),
    category: draft.category,
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

export function ExtraFoodList({ foods, onSave }: ExtraFoodListProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const startEdit = (entry: FoodEntry) => {
    setEditingId(entry.id);
    setDraft({
      category: entry.category,
      name: entry.name,
      calories: String(entry.calories),
      proteinG: typeof entry.proteinG === "number" ? String(entry.proteinG) : "",
    });
    setFormError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormError(null);
  };

  const submit = () => {
    const entry = parseDraft(draft, editingId ?? undefined);
    if (!entry) {
      setFormError(
        `음식명과 칼로리(0~${FOOD_CALORIES_MAX})를 확인해 주세요. 단백질은 0~${FOOD_PROTEIN_MAX_G}g까지 입력할 수 있어요.`,
      );
      return;
    }

    const next = editingId
      ? foods.map((item) => (item.id === editingId ? entry : item))
      : [...foods, entry];

    onSave(next);
    cancelEdit();
  };

  const remove = (entryId: string) => {
    onSave(foods.filter((item) => item.id !== entryId));
    if (editingId === entryId) {
      cancelEdit();
    }
  };

  return (
    <div className="rounded-2xl border border-gakk-sage/40 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-gakk-text">추가 음식 · 간식 · 음료</p>
      <p className="mt-1 text-xs text-gakk-text-muted">
        관리하지 않는 끼니, 외식, 간식, 음료를 기록해요. 다르게 먹은 관리
        끼니는 위의 끼니 카드에서 기록해 주세요.
      </p>

      {foods.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {foods.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-gakk-cream px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 text-gakk-text">
                <span className="mr-1 rounded-full bg-white px-2 py-0.5 text-xs text-gakk-text-muted">
                  {categoryLabel(entry.category)}
                </span>
                {entry.name}
                <span className="ml-1 text-xs text-gakk-text-muted">
                  약 {entry.calories} kcal
                  {typeof entry.proteinG === "number"
                    ? ` · 단백질 ${entry.proteinG}g`
                    : ""}
                </span>
              </span>
              <span className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(entry)}
                  className="text-xs text-gakk-text-muted underline"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => remove(entry.id)}
                  className="text-xs text-gakk-text-muted underline"
                >
                  삭제
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 space-y-2 rounded-xl border border-gakk-line bg-gakk-cream/50 p-3">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                setDraft((prev) => ({ ...prev, category: option.value }))
              }
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                draft.category === option.value
                  ? "bg-gakk-mint text-white"
                  : "bg-white text-gakk-text-muted"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <input
          value={draft.name}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, name: event.target.value }))
          }
          placeholder="음식명 (예: 라떼)"
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
        {formError ? <p className="text-xs text-gakk-coral">{formError}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            className="flex-1 rounded-xl bg-gakk-mint py-2 text-xs font-semibold text-white"
          >
            {editingId ? "수정 저장" : "추가"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="flex-1 rounded-xl border border-gakk-sage/50 bg-white py-2 text-xs font-medium text-gakk-text-muted"
            >
              취소
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
