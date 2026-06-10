"use client";

import { useState, useSyncExternalStore } from "react";
import { DiningModeForm } from "@/components/instant/DiningModeForm";
import { FridgeModeForm } from "@/components/instant/FridgeModeForm";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  getProfileServerSnapshot,
  getProfileSnapshot,
  subscribeProfile,
} from "@/lib/storage/profile-storage";
import type { InstantRecommendationMode } from "@/types/instant";

const MODE_OPTIONS: {
  mode: InstantRecommendationMode;
  title: string;
  description: string;
}[] = [
  {
    mode: "fridge",
    title: "냉장고 재료로 추천",
    description: "집에 있는 재료 중 지금 먹고 싶은 걸 골라보세요.",
  },
  {
    mode: "dining",
    title: "외식 메뉴 추천",
    description: "외식·배달·편의점 메뉴도 목표에 맞게 골라드려요.",
  },
];

export function InstantContent() {
  const [mode, setMode] = useState<InstantRecommendationMode | null>(null);
  const profileData = useSyncExternalStore(
    subscribeProfile,
    getProfileSnapshot,
    getProfileServerSnapshot,
  );

  const headerSubtitle =
    mode === null
      ? "계획과 달라도 괜찮아요. 지금 상황에 맞게 골라보세요."
      : mode === "fridge"
        ? "집에 있는 재료로 지금 끼니를 맞춰볼게요."
        : "외식·배달·편의점 메뉴를 목표에 맞게 골라볼게요.";

  return (
    <>
      <PageHeader
        backHref={mode ? undefined : "/dashboard"}
        title="지금 뭐 먹지?"
        subtitle={headerSubtitle}
      />

      <div className="space-y-4 px-5 py-4">
        {mode === null ? (
          <div className="space-y-3">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.mode}
                type="button"
                onClick={() => setMode(option.mode)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gakk-sage/40 bg-white px-4 py-4 text-left active:bg-gakk-cream"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gakk-text">{option.title}</p>
                  <p className="mt-1 text-sm text-gakk-text-muted">{option.description}</p>
                </div>
                <span className="shrink-0 text-sm text-gakk-mint">→</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="text-sm text-gakk-text-muted"
            >
              ← 추천 방식 다시 선택
            </button>

            {mode === "fridge" ? (
              <FridgeModeForm />
            ) : (
              <DiningModeForm
                remainingCalories={profileData?.targets.targetCalories}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
