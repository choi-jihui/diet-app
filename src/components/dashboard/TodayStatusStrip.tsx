interface StatusItem {
  label: string;
  value: string;
}

interface TodayStatusStripProps {
  items: StatusItem[];
}

export function TodayStatusStrip({ items }: TodayStatusStripProps) {
  return (
    <section>
      <p className="mb-2 px-1 text-xs font-medium text-gakk-text-muted">오늘의 상태</p>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-gakk-line bg-white px-3 py-2.5"
          >
            <p className="text-xs text-gakk-text-muted">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-gakk-text">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
