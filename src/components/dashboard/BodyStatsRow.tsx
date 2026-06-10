import { SUPPORTIVE_COPY } from "@/constants/copy";
import type { NutritionTargets } from "@/types/nutrition";
import type { UserProfile } from "@/types/user";

interface BodyStatsRowProps {
  profile: UserProfile;
  targets: NutritionTargets;
}

function formatLossRange(min: number, max: number): string {
  if (min === 0 && max === 0) {
    return "0 kg";
  }

  return `${min}~${max} kg`;
}

export function BodyStatsRow({ profile, targets }: BodyStatsRowProps) {
  const items = [
    { label: "현재 몸무게", value: `${profile.weightKg} kg` },
    { label: "목표 몸무게", value: `${profile.goalWeightKg} kg` },
    {
      label: "예상 주간 변화",
      value: formatLossRange(
        targets.expectedWeeklyLossKgRange.min,
        targets.expectedWeeklyLossKgRange.max,
      ),
    },
  ];

  return (
    <section className="rounded-2xl border border-gakk-line bg-white px-4 py-3.5">
      <div className="grid grid-cols-3">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={
              index > 0 ? "border-l border-gakk-line pl-3" : "pr-3"
            }
          >
            <p className="text-xs text-gakk-text-muted">{item.label}</p>
            <p className="mt-1 text-base font-semibold text-gakk-text">{item.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gakk-text-muted">{SUPPORTIVE_COPY.lossRangeNote}</p>
    </section>
  );
}
