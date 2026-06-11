export interface WeeklyReportMealLogging {
  loggedManagedMeals: number;
  expectedManagedMeals: number;
  loggingRatePercent: number | null;

  plannedMeals: number;
  customMeals: number;
  skippedMeals: number;
  unloggedMeals: number;

  plannedChoiceRatePercent: number | null;
}

export interface WeeklyReportCalories {
  daysWithCalorieRecords: number;
  averageRecordedCalories: number | null;
  averageTargetCalories: number | null;
  daysNearTarget: number;
}

export interface WeeklyReportWater {
  recordedDays: number;
  achievedDays: number;
  achievementRatePercent: number | null;
  averageWaterMl: number | null;
}

export interface WeeklyReportSleep {
  recordedDays: number;
  averageHours: number | null;
}

export interface WeeklyReportCardio {
  plannedSessions: number;
  completedSessions: number;
  completionRatePercent: number | null;
  hasPlan: boolean;
}

export interface WeeklyReportWeight {
  recordedDays: number;
  firstKg: number | null;
  lastKg: number | null;
  changeKg: number | null;
}

export interface WeeklyReportSummary {
  weekStartDate: string;
  weekEndDate: string;
  isCurrentWeek: boolean;
  elapsedDayCount: number;
  eligibleDayCount: number;

  recordedDayCount: number;
  totalDayCount: number;

  mealLogging: WeeklyReportMealLogging;
  calories: WeeklyReportCalories;
  water: WeeklyReportWater;
  sleep: WeeklyReportSleep;
  cardio: WeeklyReportCardio;
  weight: WeeklyReportWeight;

  wins: string[];
  nextStrategy: string;
}
