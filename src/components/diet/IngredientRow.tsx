"use client";

import { useState } from "react";
import type { Ingredient, IngredientPatch } from "@/types/ingredient";

interface IngredientRowProps {
  ingredient: Ingredient;
  onUpdate: (id: string, patch: IngredientPatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const inputClassName =
  "w-full rounded-xl border border-gakk-line bg-gakk-cream px-3 py-2 text-sm text-gakk-text focus:outline-none focus:ring-2 focus:ring-gakk-mint/30";

type Mode = "view" | "edit" | "confirm-delete";

export function IngredientRow({ ingredient, onUpdate, onDelete }: IngredientRowProps) {
  const [mode, setMode] = useState<Mode>("view");
  const [name, setName] = useState(ingredient.name);
  const [quantityText, setQuantityText] = useState(ingredient.quantityText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setName(ingredient.name);
    setQuantityText(ingredient.quantityText);
    setError(null);
    setMode("edit");
  };

  const handleSave = async () => {
    if (busy || name.trim().length === 0) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await onUpdate(ingredient.id, {
        name: name.trim(),
        quantityText: quantityText.trim(),
      });
      setMode("view");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "수정하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await onDelete(ingredient.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "삭제하지 못했어요.");
      setBusy(false);
      setMode("view");
    }
  };

  if (mode === "edit") {
    return (
      <li className="py-3">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="재료명"
            className={`${inputClassName} flex-1`}
          />
          <input
            value={quantityText}
            onChange={(event) => setQuantityText(event.target.value)}
            aria-label="수량"
            placeholder="수량"
            className={`${inputClassName} w-24`}
          />
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setMode("view")}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-sm text-gakk-text-muted disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || name.trim().length === 0}
            className="rounded-lg bg-gakk-mint px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "저장 중..." : "저장"}
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-gakk-coral">{error}</p> : null}
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-gakk-text">
            {ingredient.name}
          </span>
          {ingredient.priority === "use_soon" ? (
            <span className="shrink-0 text-xs text-gakk-coral">빨리 먹기</span>
          ) : null}
        </div>
        {ingredient.quantityText ? (
          <p className="mt-0.5 text-xs text-gakk-text-muted">
            {ingredient.quantityText}
          </p>
        ) : null}
        {error ? <p className="mt-1 text-xs text-gakk-coral">{error}</p> : null}
      </div>

      {mode === "confirm-delete" ? (
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-xs text-gakk-text-muted">삭제할까요?</span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-gakk-coral disabled:opacity-50"
          >
            삭제
          </button>
          <button
            type="button"
            onClick={() => setMode("view")}
            disabled={busy}
            className="rounded-lg px-2.5 py-1.5 text-sm text-gakk-text-muted disabled:opacity-50"
          >
            취소
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={startEdit}
            aria-label={`${ingredient.name} 수정`}
            className="rounded-lg px-2.5 py-1.5 text-sm text-gakk-text-muted"
          >
            수정
          </button>
          <button
            type="button"
            onClick={() => setMode("confirm-delete")}
            aria-label={`${ingredient.name} 삭제`}
            className="rounded-lg px-2.5 py-1.5 text-sm text-gakk-text-muted"
          >
            삭제
          </button>
        </div>
      )}
    </li>
  );
}
