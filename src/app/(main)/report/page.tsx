import { PageHeader } from "@/components/layout/PageHeader";
import { PlaceholderCard } from "@/components/ui/PlaceholderCard";
import { SUPPORTIVE_COPY } from "@/constants/copy";

export default function ReportPage() {
  return (
    <>
      <PageHeader
        backHref="/dashboard"
        title="주간 리포트"
        subtitle="일주일 뒤, 실행을 함께 돌아볼 수 있어요."
      />

      <div className="space-y-4 px-5 py-5">
        <div className="rounded-3xl bg-white p-5 shadow-sm border border-gakk-sage/40">
          <p className="text-sm text-gakk-text-muted">{SUPPORTIVE_COPY.weeklyReportSoon}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "평균 칼로리", value: "—" },
            { label: "식단 실행률", value: "—" },
            { label: "유산소 완료", value: "—" },
            { label: "물 목표", value: "—" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-gakk-sage/40 bg-white p-4 text-center shadow-sm"
            >
              <p className="text-xs text-gakk-text-muted">{item.label}</p>
              <p className="mt-1 text-lg font-semibold text-gakk-text">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-gakk-sage/40 bg-gakk-lime/15 p-5">
          <p className="text-sm font-semibold text-gakk-text">이번 주 잘한 점</p>
          <p className="mt-2 text-sm text-gakk-text-muted">기록이 쌓이면 여기에 표시돼요</p>
        </div>

        <div className="rounded-3xl border border-gakk-sage/40 bg-gakk-mint/10 p-5">
          <p className="text-sm font-semibold text-gakk-text">다음 주 전략</p>
          <p className="mt-2 text-sm text-gakk-text-muted">
            {SUPPORTIVE_COPY.nextMealTip}
          </p>
        </div>

        <PlaceholderCard
          phase={7}
          title="AI 주간 평가"
          description="7일 기록을 바탕으로 다음 주 계획을 함께 조정해요."
        />
      </div>
    </>
  );
}
