"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalWeek } from "@/hooks/useCardioPlan";
import { buildWeeklyReportSummary } from "@/lib/calculations/weekly-report";
import { getWeeklyCardioPlan } from "@/lib/firebase/cardio-repo";
import { getDailyLogsByDates } from "@/lib/firebase/daily-log-repo";
import type { StoredProfileData } from "@/lib/storage/profile-storage";
import { buildWeekDates, shiftWeekStartDate } from "@/lib/utils/date";
import type { WeeklyCardioPlan } from "@/types/cardio";
import { buildDailyGoalsSnapshot } from "@/types/daily-log";
import type { DailyLog } from "@/types/daily-log";
import type { WeeklyReportSummary } from "@/types/weekly-report";

const GENERIC_ERROR = "주간 리포트를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : GENERIC_ERROR;
}

export type WeeklyReportStatus = "loading" | "ready" | "error";

export interface UseWeeklyReportResult {
  status: WeeklyReportStatus;
  error: string | null;
  summary: WeeklyReportSummary | null;
  selectedWeekStart: string | null;
  canGoPrev: boolean;
  canGoNext: boolean;
  goPrevWeek: () => void;
  goNextWeek: () => void;
}

export function useWeeklyReport(
  uid: string | undefined,
  profileData: StoredProfileData | null,
): UseWeeklyReportResult {
  const localWeek = useLocalWeek();
  const currentWeekStart = localWeek?.weekStartDate ?? null;
  const today = localWeek?.today ?? null;

  const [selectedWeekStart, setSelectedWeekStart] = useState<string | undefined>();
  const effectiveWeekStart = selectedWeekStart ?? currentWeekStart ?? null;

  const [loadedWeekStart, setLoadedWeekStart] = useState<string | null>(null);
  const [logsByDate, setLogsByDate] = useState<Record<string, DailyLog | null>>(
    {},
  );
  const [cardioPlan, setCardioPlan] = useState<WeeklyCardioPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSeqRef = useRef(0);

  useEffect(() => {
    if (!uid || !effectiveWeekStart || !today) {
      return;
    }

    const seq = ++loadSeqRef.current;
    const weekDates = buildWeekDates(effectiveWeekStart).map((entry) => entry.date);

    (async () => {
      try {
        const [logs, plan] = await Promise.all([
          getDailyLogsByDates(uid, weekDates),
          getWeeklyCardioPlan(uid, effectiveWeekStart).catch(() => null),
        ]);

        if (seq !== loadSeqRef.current) {
          return;
        }

        setLogsByDate(logs);
        setCardioPlan(plan);
        setLoadedWeekStart(effectiveWeekStart);
        setError(null);
      } catch (caught) {
        if (seq !== loadSeqRef.current) {
          return;
        }
        setError(messageOf(caught));
        setLoadedWeekStart(effectiveWeekStart);
      }
    })();
  }, [uid, effectiveWeekStart, today]);

  const isLoading =
    !effectiveWeekStart ||
    !today ||
    loadedWeekStart !== effectiveWeekStart;

  const status: WeeklyReportStatus = isLoading
    ? "loading"
    : error
      ? "error"
      : "ready";

  let summary: WeeklyReportSummary | null = null;
  if (status === "ready" && profileData && effectiveWeekStart && today) {
    summary = buildWeeklyReportSummary({
      weekStartDate: effectiveWeekStart,
      today,
      logsByDate,
      fallbackGoals: buildDailyGoalsSnapshot(
        profileData.profile,
        profileData.targets,
      ),
      cardioPlan,
      cardioIntensityNone: profileData.profile.cardioIntensity === "none",
    });
  }

  const canGoNext = Boolean(
    currentWeekStart &&
      effectiveWeekStart &&
      effectiveWeekStart < currentWeekStart,
  );
  const canGoPrev = Boolean(effectiveWeekStart);

  const goPrevWeek = useCallback(() => {
    if (!effectiveWeekStart) {
      return;
    }
    setSelectedWeekStart(shiftWeekStartDate(effectiveWeekStart, -1));
  }, [effectiveWeekStart]);

  const goNextWeek = useCallback(() => {
    if (!effectiveWeekStart || !currentWeekStart) {
      return;
    }
    const next = shiftWeekStartDate(effectiveWeekStart, 1);
    if (next > currentWeekStart) {
      return;
    }
    setSelectedWeekStart(next);
  }, [effectiveWeekStart, currentWeekStart]);

  return {
    status,
    error,
    summary,
    selectedWeekStart: effectiveWeekStart,
    canGoPrev,
    canGoNext,
    goPrevWeek,
    goNextWeek,
  };
}
