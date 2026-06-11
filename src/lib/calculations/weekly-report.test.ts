import { describe, expect, it } from "vitest";
import { hasCalorieEntriesInLog } from "@/lib/calculations/daily-log-summary";
import { patchPayloadWithGoalsSnapshot } from "@/lib/calculations/goals-snapshot-policy";
import {
  buildWeeklyReportSummary,
  isRecordedDay,
  resolveDayGoals,
  safePercent,
} from "@/lib/calculations/weekly-report";
import type { WeeklyCardioPlan } from "@/types/cardio";
import type { DailyGoalsSnapshot, DailyLog } from "@/types/daily-log";

const fallbackGoals: DailyGoalsSnapshot = {
  targetCalories: 1500,
  waterGoalMl: 2000,
  proteinGoalG: 100,
  managedMealSlots: ["breakfast", "lunch", "dinner"],
};

const legacySnapshot: DailyGoalsSnapshot = {
  targetCalories: 1400,
  waterGoalMl: 1800,
  proteinGoalG: 90,
  managedMealSlots: ["breakfast", "dinner"],
};

const weekStart = "2026-06-08";
const mon = "2026-06-08";
const tue = "2026-06-09";
const wed = "2026-06-10";
const thu = "2026-06-11";
const fri = "2026-06-12";
const sat = "2026-06-13";
const sun = "2026-06-14";

function emptyWeekLogs(): Record<string, DailyLog | null> {
  return {
    [mon]: null,
    [tue]: null,
    [wed]: null,
    [thu]: null,
    [fri]: null,
    [sat]: null,
    [sun]: null,
  };
}

describe("safePercent", () => {
  it("returns null when denominator is 0", () => {
    expect(safePercent(1, 0)).toBeNull();
  });

  it("clamps to 0-100", () => {
    expect(safePercent(2, 1)).toBe(100);
    expect(safePercent(0, 5)).toBe(0);
  });
});

describe("goalsSnapshot policy", () => {
  it("adds snapshot when existing document has none", () => {
    const payload = patchPayloadWithGoalsSnapshot(undefined, fallbackGoals, {
      waterMl: 500,
    });
    expect(payload.goalsSnapshot).toEqual(fallbackGoals);
  });

  it("keeps existing snapshot when profile changes", () => {
    const payload = patchPayloadWithGoalsSnapshot(
      legacySnapshot,
      fallbackGoals,
      { waterMl: 500 },
    );
    expect(payload.goalsSnapshot).toBeUndefined();
  });
});

describe("resolveDayGoals", () => {
  it("prefers dailyLog.goalsSnapshot over fallback", () => {
    const log: DailyLog = {
      date: mon,
      goalsSnapshot: legacySnapshot,
    };
    expect(resolveDayGoals(log, fallbackGoals)).toEqual(legacySnapshot);
  });
});

describe("isRecordedDay", () => {
  it("excludes empty documents with only metadata", () => {
    expect(isRecordedDay({ date: mon, goalsSnapshot: fallbackGoals })).toBe(
      false,
    );
  });

  it("includes skipped-only meal days", () => {
    expect(
      isRecordedDay({
        date: mon,
        meals: {
          breakfast: { slot: "breakfast", status: "skipped" },
        },
      }),
    ).toBe(true);
  });
});

describe("hasCalorieEntriesInLog", () => {
  it("excludes skipped-only days", () => {
    expect(
      hasCalorieEntriesInLog({
        date: mon,
        meals: {
          breakfast: { slot: "breakfast", status: "skipped" },
          lunch: { slot: "lunch", status: "skipped" },
        },
      }),
    ).toBe(false);
  });

  it("excludes water-only days", () => {
    expect(
      hasCalorieEntriesInLog({
        date: mon,
        waterMl: 1500,
      }),
    ).toBe(false);
  });

  it("includes planned meals", () => {
    expect(
      hasCalorieEntriesInLog({
        date: mon,
        meals: {
          breakfast: {
            slot: "breakfast",
            status: "planned",
            plannedOption: {
              optionType: "fat_loss",
              title: "샐러드",
              estimatedCalories: 0,
              estimatedProteinG: 10,
            },
          },
        },
      }),
    ).toBe(true);
  });
});

describe("buildWeeklyReportSummary", () => {
  it("excludes Fri-Sun from denominators on current Thursday week", () => {
    const logs = emptyWeekLogs();
    logs[mon] = {
      date: mon,
      meals: {
        breakfast: { slot: "breakfast", status: "skipped" },
      },
    };

    const summary = buildWeeklyReportSummary({
      weekStartDate: weekStart,
      today: thu,
      logsByDate: logs,
      fallbackGoals,
      cardioPlan: null,
      cardioIntensityNone: true,
    });

    expect(summary.elapsedDayCount).toBe(4);
    expect(summary.eligibleDayCount).toBe(4);
    expect(summary.mealLogging.expectedManagedMeals).toBe(12);
    expect(summary.mealLogging.unloggedMeals).toBe(11);
  });

  it("uses full 7 days for completed past weeks", () => {
    const summary = buildWeeklyReportSummary({
      weekStartDate: weekStart,
      today: thu,
      logsByDate: emptyWeekLogs(),
      fallbackGoals,
      cardioPlan: null,
      cardioIntensityNone: true,
    });

    const pastWeekSummary = buildWeeklyReportSummary({
      weekStartDate: "2026-06-01",
      today: thu,
      logsByDate: emptyWeekLogs(),
      fallbackGoals,
      cardioPlan: null,
      cardioIntensityNone: true,
    });

    expect(summary.mealLogging.expectedManagedMeals).toBe(12);
    expect(pastWeekSummary.mealLogging.expectedManagedMeals).toBe(21);
  });

  it("excludes skipped-only days from calorie average but counts as recorded day", () => {
    const logs = emptyWeekLogs();
    logs[mon] = {
      date: mon,
      meals: {
        breakfast: { slot: "breakfast", status: "skipped" },
        lunch: { slot: "lunch", status: "skipped" },
        dinner: { slot: "dinner", status: "skipped" },
      },
    };
    logs[tue] = {
      date: tue,
      meals: {
        breakfast: {
          slot: "breakfast",
          status: "planned",
          plannedOption: {
            optionType: "filling",
            title: "밥",
            estimatedCalories: 500,
            estimatedProteinG: 20,
          },
        },
      },
    };

    const summary = buildWeeklyReportSummary({
      weekStartDate: weekStart,
      today: fri,
      logsByDate: logs,
      fallbackGoals,
      cardioPlan: null,
      cardioIntensityNone: true,
    });

    expect(summary.recordedDayCount).toBe(2);
    expect(summary.calories.daysWithCalorieRecords).toBe(1);
    expect(summary.calories.averageRecordedCalories).toBe(500);
  });

  it("deduplicates cardio completions and caps at 100%", () => {
    const sessionId = `${weekStart}-${mon}-walking-0`;
    const cardioPlan: WeeklyCardioPlan = {
      weekStartDate: weekStart,
      settings: {
        cardioExperience: "beginner",
        preferredDurationMin: 30,
        preferredCardioTypes: ["walking"],
        availableDays: [0, 2, 4],
      },
      sessions: [
        {
          id: sessionId,
          date: mon,
          dayLabel: "월",
          dayIndex: 0,
          type: "walking",
          durationMin: 30,
          intensity: "easy",
          note: "",
        },
      ],
    };

    const logs = emptyWeekLogs();
    logs[mon] = {
      date: mon,
      cardio: {
        planWeekStartDate: weekStart,
        plannedSessionId: sessionId,
        plannedType: "walking",
        plannedDurationMin: 30,
        completed: true,
        completedAt: null,
      },
    };

    const summary = buildWeeklyReportSummary({
      weekStartDate: weekStart,
      today: fri,
      logsByDate: logs,
      fallbackGoals,
      cardioPlan,
      cardioIntensityNone: false,
    });

    expect(summary.cardio.plannedSessions).toBe(1);
    expect(summary.cardio.completedSessions).toBe(1);
    expect(summary.cardio.completionRatePercent).toBe(100);
  });

  it("ignores cardio completion when session id is not in current plan", () => {
    const cardioPlan: WeeklyCardioPlan = {
      weekStartDate: weekStart,
      settings: {
        cardioExperience: "beginner",
        preferredDurationMin: 30,
        preferredCardioTypes: ["walking"],
        availableDays: [0],
      },
      sessions: [
        {
          id: `${weekStart}-${mon}-walking-0`,
          date: mon,
          dayLabel: "월",
          dayIndex: 0,
          type: "walking",
          durationMin: 30,
          intensity: "easy",
          note: "",
        },
      ],
    };

    const logs = emptyWeekLogs();
    logs[mon] = {
      date: mon,
      cardio: {
        planWeekStartDate: weekStart,
        plannedSessionId: "old-session-id",
        plannedType: "walking",
        plannedDurationMin: 30,
        completed: true,
        completedAt: null,
      },
    };

    const summary = buildWeeklyReportSummary({
      weekStartDate: weekStart,
      today: fri,
      logsByDate: logs,
      fallbackGoals,
      cardioPlan,
      cardioIntensityNone: false,
    });

    expect(summary.cardio.completedSessions).toBe(0);
    expect(summary.cardio.completionRatePercent).toBe(0);
  });

  it("shows null completion rate when there is no cardio plan", () => {
    const summary = buildWeeklyReportSummary({
      weekStartDate: weekStart,
      today: fri,
      logsByDate: emptyWeekLogs(),
      fallbackGoals,
      cardioPlan: null,
      cardioIntensityNone: true,
    });

    expect(summary.cardio.hasPlan).toBe(false);
    expect(summary.cardio.completionRatePercent).toBeNull();
  });

  it("uses per-day goalsSnapshot for water achievement", () => {
    const logs = emptyWeekLogs();
    logs[mon] = {
      date: mon,
      goalsSnapshot: {
        targetCalories: 1400,
        waterGoalMl: 1000,
        proteinGoalG: 90,
        managedMealSlots: ["breakfast", "dinner"],
      },
      waterMl: 1200,
    };

    const summary = buildWeeklyReportSummary({
      weekStartDate: weekStart,
      today: fri,
      logsByDate: logs,
      fallbackGoals,
      cardioPlan: null,
      cardioIntensityNone: true,
    });

    expect(summary.water.achievedDays).toBe(1);
  });

  it("limits wins to three items", () => {
    const logs = emptyWeekLogs();
    for (const date of [mon, tue, wed, thu, fri]) {
      logs[date] = {
        date,
        meals: {
          breakfast: {
            slot: "breakfast",
            status: "planned",
            plannedOption: {
              optionType: "fat_loss",
              title: "메뉴",
              estimatedCalories: 400,
              estimatedProteinG: 20,
            },
          },
          lunch: {
            slot: "lunch",
            status: "planned",
            plannedOption: {
              optionType: "fat_loss",
              title: "메뉴",
              estimatedCalories: 500,
              estimatedProteinG: 25,
            },
          },
          dinner: {
            slot: "dinner",
            status: "planned",
            plannedOption: {
              optionType: "fat_loss",
              title: "메뉴",
              estimatedCalories: 500,
              estimatedProteinG: 25,
            },
          },
        },
        waterMl: 2500,
        sleepHours: 7,
      };
    }

    const cardioPlan: WeeklyCardioPlan = {
      weekStartDate: weekStart,
      settings: {
        cardioExperience: "beginner",
        preferredDurationMin: 30,
        preferredCardioTypes: ["walking"],
        availableDays: [0, 2, 4],
      },
      sessions: [
        {
          id: `${weekStart}-${mon}-walking-0`,
          date: mon,
          dayLabel: "월",
          dayIndex: 0,
          type: "walking",
          durationMin: 30,
          intensity: "easy",
          note: "",
        },
      ],
    };
    logs[mon]!.cardio = {
      planWeekStartDate: weekStart,
      plannedSessionId: `${weekStart}-${mon}-walking-0`,
      plannedType: "walking",
      plannedDurationMin: 30,
      completed: true,
      completedAt: null,
    };

    const summary = buildWeeklyReportSummary({
      weekStartDate: weekStart,
      today: fri,
      logsByDate: logs,
      fallbackGoals,
      cardioPlan,
      cardioIntensityNone: false,
    });

    expect(summary.wins.length).toBeLessThanOrEqual(3);
    expect(summary.nextStrategy).toBeTruthy();
  });
});
