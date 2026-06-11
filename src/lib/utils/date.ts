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

function parseYmdLocal(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** weekStartDate(월요일)를 weeks만큼 이동한다. 음수 = 이전 주. */
export function shiftWeekStartDate(weekStartDate: string, weeks: number): string {
  const date = parseYmdLocal(weekStartDate);
  date.setDate(date.getDate() + weeks * 7);
  return formatYmd(date);
}

/** 주간 범위를 한국어로 표시한다. 예: 6월 8일 – 6월 14일 */
export function formatWeekRangeKo(weekStartDate: string): string {
  const weekDates = buildWeekDates(weekStartDate);
  const start = parseYmdLocal(weekDates[0].date);
  const end = parseYmdLocal(weekDates[6].date);
  const startLabel = `${start.getMonth() + 1}월 ${start.getDate()}일`;
  const endLabel = `${end.getMonth() + 1}월 ${end.getDate()}일`;
  return `${startLabel} – ${endLabel}`;
}

/** 선택 주가 현재 주인지 판별한다. */
export function isCurrentWeek(weekStartDate: string, today: string): boolean {
  return weekStartDate === getWeekStartDate(parseYmdLocal(today));
}

/**
 * 현재 주면 월요일~오늘까지 경과 일수(1~7).
 * 완료된 과거 주면 7.
 */
export function getElapsedDayCount(
  weekStartDate: string,
  today: string,
  currentWeek: boolean,
): number {
  if (!currentWeek) {
    return 7;
  }

  const weekDates = buildWeekDates(weekStartDate);
  const todayIndex = weekDates.findIndex((entry) => entry.date === today);
  if (todayIndex < 0) {
    return 7;
  }
  return todayIndex + 1;
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
