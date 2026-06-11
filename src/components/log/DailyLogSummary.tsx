import type { DailyLogSummaryResult } from "@/lib/calculations/daily-log-summary";

interface DailyLogSummaryProps {
  summary: DailyLogSummaryResult;
  feedbackLines: string[];
}

export function DailyLogSummary({ summary, feedbackLines }: DailyLogSummaryProps) {
  const {
    consumedCalories,
    targetCalories,
    differenceCalories,
    loggedManagedMealCount,
    totalManagedMealCount,
    hasUnloggedMeals,
    hasAnyFoodRecord,
    knownProteinTotalG,
  } = summary;

  const differenceLine = !hasAnyFoodRecord
    ? null
    : differenceCalories >= 0
      ? `입력한 항목 기준 약 ${differenceCalories.toLocaleString()} kcal 남았어요`
      : `목표보다 약 ${Math.abs(differenceCalories).toLocaleString()} kcal 높게 기록됐어요. 한 끼로 전체 흐름이 정해지지는 않아요.`;

  return (
    <div className="rounded-2xl border border-gakk-sage/40 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-gakk-text">오늘 섭취 기록</p>
        {totalManagedMealCount > 0 ? (
          <p className="text-xs text-gakk-text-muted">
            기록 {loggedManagedMealCount}/{totalManagedMealCount}끼
          </p>
        ) : null}
      </div>

      <p className="mt-2 text-3xl font-bold text-gakk-text">
        {hasAnyFoodRecord ? `약 ${consumedCalories.toLocaleString()}` : "—"}{" "}
        <span className="text-base font-semibold">kcal</span>
      </p>

      <p className="mt-1 text-sm text-gakk-text-muted">
        목표 {targetCalories.toLocaleString()} kcal
        {hasUnloggedMeals && hasAnyFoodRecord ? " · 입력한 항목 기준" : ""}
      </p>

      {differenceLine ? (
        <p className="mt-2 text-sm text-gakk-text">{differenceLine}</p>
      ) : null}

      {hasAnyFoodRecord && knownProteinTotalG > 0 ? (
        <p className="mt-1 text-xs text-gakk-text-muted">
          입력된 항목 기준 단백질 약 {knownProteinTotalG}g
        </p>
      ) : null}

      {feedbackLines.length > 0 ? (
        <div className="mt-3 space-y-1 border-t border-gakk-line pt-3">
          {feedbackLines.map((line, index) => (
            <p key={index} className="text-sm text-gakk-text-muted">
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
