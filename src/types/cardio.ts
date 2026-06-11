export type CardioType = "walking" | "running" | "cycling";

export type CardioExperience = "beginner" | "intermediate" | "experienced";

export type CardioSessionIntensity = "easy" | "moderate";

export type PreferredCardioDurationMin = 20 | 30 | 45 | 60;

/** 루틴 생성 입력. 프로필이 아닌 plan 문서의 snapshot으로 저장한다. */
export interface CardioSettings {
  cardioExperience: CardioExperience;
  preferredDurationMin: PreferredCardioDurationMin;
  preferredCardioTypes: CardioType[];
  /** 0(월) ~ 6(일) */
  availableDays: number[];
}

export interface CardioSession {
  /** `${weekStartDate}-${date}-${type}-${index}` — 동일 입력이면 동일 ID */
  id: string;
  date: string;
  dayLabel: string;
  /** 0(월) ~ 6(일) */
  dayIndex: number;
  type: CardioType;
  durationMin: number;
  intensity: CardioSessionIntensity;
  note: string;
}

export interface WeeklyCardioPlan {
  weekStartDate: string;
  settings: CardioSettings;
  sessions: CardioSession[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** dailyLogs/{date}.cardio — 계획 snapshot을 함께 저장한다. */
export interface DailyLogCardio {
  planWeekStartDate: string;
  plannedSessionId: string;
  plannedType: CardioType;
  plannedDurationMin: number;
  completed: boolean;
  completedAt: unknown | null;
  actualDurationMin?: number;
}
