const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export function formatYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 주어진 날짜가 속한 주의 월요일을 YYYY-MM-DD로 반환한다(로컬 타임존). */
export function getWeekStartDate(base: Date = new Date()): string {
  const local = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const dayOfWeek = local.getDay(); // 0(일) ~ 6(토)
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  local.setDate(local.getDate() - daysSinceMonday);
  return formatYmd(local);
}

export interface WeekDate {
  date: string;
  dayLabel: string;
}

/** weekStartDate(월요일)부터 연속된 7일의 날짜·요일 라벨을 반환한다. */
export function buildWeekDates(weekStartDate: string): WeekDate[] {
  const [year, month, day] = weekStartDate.split("-").map(Number);
  const start = new Date(year, month - 1, day);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + index,
    );
    return { date: formatYmd(current), dayLabel: DAY_LABELS[index] };
  });
}
