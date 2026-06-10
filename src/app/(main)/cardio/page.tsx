import { PageHeader } from "@/components/layout/PageHeader";
import { PlaceholderCard } from "@/components/ui/PlaceholderCard";

export default function CardioPage() {
  return (
    <>
      <PageHeader
        title="유산소"
        subtitle="오늘 컨디션에 맞게, 무리하지 않는 선에서 추천해요."
      />

      <div className="space-y-4 px-5 py-5">
        <div className="rounded-3xl border border-gakk-sage/40 bg-gakk-lime/20 p-5 shadow-sm">
          <p className="text-sm font-semibold text-gakk-text">오늘의 유산소</p>
          <p className="mt-2 text-2xl font-bold text-gakk-text">걷기 30분</p>
          <p className="mt-2 text-sm text-gakk-text-muted">예상 소모 — ~ kcal</p>
        </div>

        <div className="rounded-3xl border border-gakk-sage/40 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-gakk-text">이번 주 루틴</p>
          <ul className="mt-4 space-y-3">
            {["월", "수", "금"].map((day) => (
              <li
                key={day}
                className="flex items-center justify-between rounded-2xl bg-gakk-cream px-4 py-3 text-sm"
              >
                <span className="font-medium text-gakk-text">{day}요일</span>
                <span className="text-gakk-text-muted">걷기 · 30분</span>
              </li>
            ))}
          </ul>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-gakk-sage/40 bg-white px-4 py-4 shadow-sm">
          <input type="checkbox" disabled className="h-5 w-5 rounded accent-gakk-coral" />
          <span className="text-sm font-medium text-gakk-text">오늘 유산소 완료</span>
        </label>

        <PlaceholderCard
          phase={6}
          title="AI 유산소 루틴"
          description="수면, 컨디션, 선호 운동을 반영해 주간 루틴을 만들어요."
        />
      </div>
    </>
  );
}
