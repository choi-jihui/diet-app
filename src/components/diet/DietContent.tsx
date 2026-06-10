"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FridgePanel } from "@/components/diet/FridgePanel";
import { WeekPlanPanel } from "@/components/diet/WeekPlanPanel";
import { QuickLinkCard } from "@/components/ui/QuickLinkCard";

export type DietTab = "fridge" | "plan";

const TABS: { value: DietTab; label: string }[] = [
  { value: "fridge", label: "냉장고" },
  { value: "plan", label: "이번 주 식단" },
];

export function DietContent({ initialTab }: { initialTab: DietTab }) {
  const [tab, setTab] = useState<DietTab>(initialTab);
  const router = useRouter();
  const pathname = usePathname();

  const handleTab = (next: DietTab) => {
    setTab(next);
    router.replace(`${pathname}?tab=${next}`, { scroll: false });
  };

  return (
    <div className="space-y-5 px-5 py-4">
      <QuickLinkCard
        href="/instant"
        variant="primary"
        title="지금 뭐 먹지?"
        description="계획과 다른 메뉴가 당길 때, 목표에 맞게 다시 골라드려요."
      />

      <div
        role="tablist"
        aria-label="식단 보기"
        className="flex gap-1 rounded-full border border-gakk-line bg-white p-1"
      >
        {TABS.map((item) => {
          const isActive = tab === item.value;

          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTab(item.value)}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-gakk-mint text-white"
                  : "text-gakk-text-muted"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "fridge" ? (
        <FridgePanel />
      ) : (
        <WeekPlanPanel onGoToFridge={() => handleTab("fridge")} />
      )}
    </div>
  );
}
