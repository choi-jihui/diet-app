"use client";

import { useMemo } from "react";
import { IngredientAddForm } from "@/components/diet/IngredientAddForm";
import { IngredientRow } from "@/components/diet/IngredientRow";
import { useIngredients } from "@/hooks/useIngredients";
import { useAuth } from "@/lib/auth/useAuth";
import { normalizeName } from "@/lib/ingredients/parse";

export function FridgeManager() {
  const { user } = useAuth();
  const { items, status, error, reload, addMany, update, remove } = useIngredients(
    user?.uid,
  );

  const existingNames = useMemo(
    () => new Set(items.map((item) => normalizeName(item.name))),
    [items],
  );

  return (
    <div className="space-y-4">
      <p className="px-1 text-sm text-gakk-text-muted">
        냉장고에 있는 재료를 적어주세요. 쉼표나 줄바꿈으로 여러 개를 한 번에 추가할 수
        있어요.
      </p>

      <IngredientAddForm existingNames={existingNames} onSave={addMany} />

      {status === "loading" ? (
        <p className="px-1 py-6 text-center text-sm text-gakk-text-muted">
          불러오는 중...
        </p>
      ) : null}

      {status === "error" ? (
        <div className="rounded-2xl border border-gakk-line bg-white p-5 text-center">
          <p className="text-sm text-gakk-text-muted">
            {error ?? "재료를 불러오지 못했어요."}
          </p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-3 rounded-2xl bg-gakk-mint px-5 py-2 text-sm font-semibold text-white"
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {status === "ready" && items.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-gakk-text-muted">
          냉장고에 있는 재료를 적어보세요. 한 번에 여러 개를 추가할 수 있어요.
        </p>
      ) : null}

      {status === "ready" && items.length > 0 ? (
        <section>
          <p className="mb-1 px-1 text-xs font-medium text-gakk-text-muted">
            저장된 재료 {items.length}개
          </p>
          <ul className="divide-y divide-gakk-line rounded-2xl border border-gakk-line bg-white px-4">
            {items.map((ingredient) => (
              <IngredientRow
                key={ingredient.id}
                ingredient={ingredient}
                onUpdate={update}
                onDelete={remove}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
