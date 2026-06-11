import type { WeeklyReportSummary } from "@/types/weekly-report";

interface WeeklySummarySectionProps {
  summary: WeeklyReportSummary;
  weekRangeLabel: string;
  onPrev: () => void;
  onNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

export function WeeklySummarySection({
  summary,
  weekRangeLabel,
  onPrev,
  onNext,
  canGoPrev,
  canGoNext,
}: WeeklySummarySectionProps) {
  const progressLabel = summary.isCurrentWeek
    ? `이번 주 진행 중 · ${summary.elapsedDayCount}/7일`
    : "완료된 주";

  const recordedLabel = `기록한 날 ${summary.recordedDayCount}일`;

  let headline = "";
  if (summary.recordedDayCount === 0) {
    headline = summary.isCurrentWeek
      ? "아직 이번 주 기록이 없어요."
      : "이번 주 기록이 없어요.";
  } else if (summary.recordedDayCount <= 2) {
    headline = "아직 기록이 적어서 현재 흐름만 보여드려요.";
  } else if (
    summary.mealLogging.loggingRatePercent !== null &&
    summary.mealLogging.loggingRatePercent >= 70
  ) {
    headline = "식사 기록을 꾸준히 남긴 한 주였어요.";
  } else {
    headline = "이번 주 기록 흐름을 함께 돌아봤어요.";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canGoPrev}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gakk-text-muted shadow-sm disabled:opacity-30"
          aria-label="이전 주"
        >
          ‹
        </button>
        <p className="text-center text-sm font-semibold text-gakk-text">
          {weekRangeLabel}
        </p>
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gakk-text-muted shadow-sm disabled:opacity-30"
          aria-label="다음 주"
        >
          ›
        </button>
      </div>

      <div className="rounded-2xl border border-gakk-sage/40 bg-white px-4 py-3">
        <p className="text-xs text-gakk-text-muted">{progressLabel}</p>
        {summary.isCurrentWeek ? (
          <p className="mt-1 text-xs text-gakk-text-muted">{recordedLabel}</p>
        ) : null}
        <p className="mt-2 text-sm font-medium text-gakk-text">{headline}</p>
      </div>
    </div>
  );
}
