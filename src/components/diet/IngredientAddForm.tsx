"use client";

import { useState } from "react";
import {
  dedupeParsed,
  normalizeName,
  parseIngredientsInput,
} from "@/lib/ingredients/parse";
import type { IngredientInput, ParsedIngredient } from "@/types/ingredient";

interface IngredientAddFormProps {
  existingNames: Set<string>;
  onSave: (inputs: IngredientInput[]) => Promise<void>;
}

const inputClassName =
  "w-full rounded-xl border border-gakk-line bg-gakk-cream px-3 py-2 text-sm text-gakk-text placeholder:text-gakk-text-muted/60 focus:outline-none focus:ring-2 focus:ring-gakk-mint/30";

export function IngredientAddForm({ existingNames, onSave }: IngredientAddFormProps) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParsedIngredient[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = () => {
    const parsed = dedupeParsed(parseIngredientsInput(text));
    if (parsed.length === 0) {
      return;
    }
    setError(null);
    setPreview(parsed);
  };

  const updatePreview = (index: number, patch: Partial<ParsedIngredient>) => {
    setPreview((prev) =>
      prev
        ? prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
        : prev,
    );
  };

  const removePreview = (index: number) => {
    setPreview((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  };

  const handleCancel = () => {
    setPreview(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!preview || saving) {
      return;
    }

    const inputs: IngredientInput[] = preview
      .map((item) => ({
        name: item.name.trim(),
        quantityText: item.quantityText.trim(),
      }))
      .filter((item) => item.name.length > 0);

    if (inputs.length === 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(inputs);
      setText("");
      setPreview(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "저장 중 문제가 생겼어요. 다시 시도해 주세요.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gakk-line bg-white p-4">
      {preview === null ? (
        <>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={"예: 계란 6개, 사과 3개, 참치 2캔\n양배추 반 통"}
            rows={3}
            className={`${inputClassName} resize-none`}
          />
          <button
            type="button"
            onClick={handleParse}
            disabled={text.trim().length === 0}
            className="mt-3 w-full rounded-2xl bg-gakk-mint py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            재료 추가
          </button>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-gakk-text">
            추가할 재료 ({preview.length})
          </p>
          <p className="mt-1 text-xs text-gakk-text-muted">
            이름과 수량을 다듬은 뒤 저장하세요.
          </p>

          <ul className="mt-3 divide-y divide-gakk-line">
            {preview.map((item, index) => {
              const isDuplicate = existingNames.has(normalizeName(item.name));

              return (
                <li key={index} className="py-3">
                  <input
                    value={item.name}
                    onChange={(event) =>
                      updatePreview(index, { name: event.target.value })
                    }
                    aria-label="재료명"
                    placeholder="재료명"
                    className={`${inputClassName} block w-full min-w-0`}
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={item.quantityText}
                      onChange={(event) =>
                        updatePreview(index, { quantityText: event.target.value })
                      }
                      aria-label="수량"
                      placeholder="수량"
                      className={`${inputClassName} min-w-0 flex-1`}
                    />
                    {isDuplicate ? (
                      <span className="shrink-0 text-xs text-gakk-coral">
                        이미 있어요
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removePreview(index)}
                      aria-label="이 재료 제외"
                      className="shrink-0 rounded-lg border border-gakk-line px-3 py-2 text-sm text-gakk-text-muted"
                    >
                      제외
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="flex-1 rounded-2xl border border-gakk-line py-2.5 text-sm font-semibold text-gakk-text-muted disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || preview.length === 0}
              className="flex-1 rounded-2xl bg-gakk-mint py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </>
      )}

      {error ? <p className="mt-3 text-sm text-gakk-coral">{error}</p> : null}
    </div>
  );
}
