interface WeeklyMetricRowProps {
  label: string;
  value: string;
  detail?: string;
  progressPercent?: number | null;
}

export function WeeklyMetricRow({
  label,
  value,
  detail,
  progressPercent,
}: WeeklyMetricRowProps) {
  return (
    <div className="rounded-2xl border border-gakk-sage/40 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gakk-text-muted">{label}</p>
        <p className="text-right text-sm font-semibold text-gakk-text">{value}</p>
      </div>
      {detail ? (
        <p className="mt-1 text-xs text-gakk-text-muted">{detail}</p>
      ) : null}
      {typeof progressPercent === "number" ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gakk-cream">
          <div
            className="h-full rounded-full bg-gakk-mint transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
