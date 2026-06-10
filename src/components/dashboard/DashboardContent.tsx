"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { BodyStatsRow } from "@/components/dashboard/BodyStatsRow";
import { CalorieHeroCard } from "@/components/dashboard/CalorieHeroCard";
import { FridgeCountLine } from "@/components/dashboard/FridgeCountLine";
import { TodayStatusStrip } from "@/components/dashboard/TodayStatusStrip";
import { SUPPORTIVE_COPY } from "@/constants/copy";
import {
  getProfileServerSnapshot,
  getProfileSnapshot,
  subscribeProfile,
} from "@/lib/storage/profile-storage";

export function DashboardContent() {
  const data = useSyncExternalStore(
    subscribeProfile,
    getProfileSnapshot,
    getProfileServerSnapshot,
  );

  if (!data) {
    return (
      <div className="px-5 py-5">
        <div className="rounded-2xl border border-gakk-line bg-white p-5">
          <h2 className="text-base font-semibold text-gakk-text">
            {SUPPORTIVE_COPY.noProfileTitle}
          </h2>
          <p className="mt-2 text-sm text-gakk-text-muted">
            {SUPPORTIVE_COPY.noProfileDescription}
          </p>
          <Link
            href="/onboarding"
            className="mt-4 flex h-11 w-full items-center justify-center rounded-2xl bg-gakk-mint text-sm font-semibold text-white"
          >
            설정하러 가기
          </Link>
        </div>
      </div>
    );
  }

  const { profile, targets } = data;

  return (
    <div className="space-y-4 px-5 py-4">
      <CalorieHeroCard targets={targets} />

      <BodyStatsRow profile={profile} targets={targets} />

      {targets.cautionNote ? (
        <p className="px-1 text-xs leading-relaxed text-gakk-coral">
          {targets.cautionNote}
        </p>
      ) : null}

      <TodayStatusStrip
        items={[
          { label: "식단", value: "0%" },
          { label: "물", value: "0%" },
          { label: "운동", value: "미완료" },
        ]}
      />

      <FridgeCountLine />
    </div>
  );
}
