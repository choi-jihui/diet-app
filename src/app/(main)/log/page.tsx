import { PageHeader } from "@/components/layout/PageHeader";
import { PlaceholderCard } from "@/components/ui/PlaceholderCard";
import { LogMealChecklist } from "@/components/log/LogMealChecklist";
import { SUPPORTIVE_COPY } from "@/constants/copy";

export default function LogPage() {
  return (
    <>
      <PageHeader
        title="오늘 기록"
        subtitle="계획한 식단을 먹었는지 먼저 체크해 보세요."
      />

      <div className="space-y-4 px-5 py-5">
        <div className="rounded-3xl border border-gakk-sage/40 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-gakk-text">오늘 섭취 칼로리</p>
          <p className="mt-2 text-3xl font-bold text-gakk-text">— kcal</p>
          <p className="mt-2 text-sm text-gakk-text-muted">목표 대비 — kcal</p>
        </div>

        <LogMealChecklist />

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-gakk-sage/40 bg-white p-4 shadow-sm">
            <label htmlFor="water" className="text-xs text-gakk-text-muted">
              물 (ml)
            </label>
            <input
              id="water"
              readOnly
              placeholder="1500"
              className="mt-2 w-full bg-transparent text-lg font-semibold text-gakk-text placeholder:text-gakk-text-muted/50 focus:outline-none"
            />
          </div>
          <div className="rounded-2xl border border-gakk-sage/40 bg-white p-4 shadow-sm">
            <label htmlFor="sleep" className="text-xs text-gakk-text-muted">
              수면 (시간)
            </label>
            <input
              id="sleep"
              readOnly
              placeholder="7"
              className="mt-2 w-full bg-transparent text-lg font-semibold text-gakk-text placeholder:text-gakk-text-muted/50 focus:outline-none"
            />
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-gakk-sage/40 bg-white px-4 py-4 shadow-sm">
          <input
            type="checkbox"
            disabled
            className="h-5 w-5 rounded accent-gakk-coral"
          />
          <span className="text-sm font-medium text-gakk-text">오늘 운동했어요</span>
        </label>

        <PlaceholderCard
          phase={6}
          title="하루 마감 정리"
          description="오늘 기록을 바탕으로 부드러운 피드백과 내일 조정 제안을 받아요."
        />

        <p className="text-center text-sm text-gakk-text-muted">
          {SUPPORTIVE_COPY.nextMealTip}
        </p>
      </div>
    </>
  );
}
