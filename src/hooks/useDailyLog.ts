"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalWeek } from "@/hooks/useCardioPlan";
import {
  addWaterMl,
  getDailyLog,
  setCardioCompletion,
  setExtraFoods,
  setMealLog,
  setSleepHours,
  setWaterMl,
  setWeightKg,
} from "@/lib/firebase/daily-log-repo";
import { getWeeklyCardioPlan } from "@/lib/firebase/cardio-repo";
import { WATER_MAX_ML } from "@/types/daily-log";
import type { CardioSession, WeeklyCardioPlan } from "@/types/cardio";
import type {
  DailyGoalsSnapshot,
  DailyLog,
  FoodEntry,
  MealLog,
} from "@/types/daily-log";
import type { MealSlotType } from "@/types/meal";

const GENERIC_ERROR = "기록을 저장하지 못했어요. 다시 시도해 주세요.";

export type DailyLogStatus = "loading" | "ready" | "error";
export type SaveIndicator = "idle" | "saving" | "saved" | "error";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : GENERIC_ERROR;
}

interface LoadedLog {
  date: string;
  log: DailyLog | null;
}

interface LoadErrorState {
  date: string;
  message: string;
}

export function useDailyLog(
  uid: string | undefined,
  date: string | undefined,
  goalsSnapshot?: DailyGoalsSnapshot | null,
) {
  // 날짜와 함께 저장해, 이전 날짜 응답이 새 날짜 화면을 덮지 않게 한다.
  const [loaded, setLoaded] = useState<LoadedLog | null>(null);
  const [loadErrorState, setLoadErrorState] = useState<LoadErrorState | null>(
    null,
  );

  // 저장 상태: 단일 boolean 대신 pending count + mutation id로 race 방지
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);
  const [hasSavedOnce, setHasSavedOnce] = useState(false);

  const loadSeqRef = useRef(0);
  const mutationSeqRef = useRef(0);
  const lastErrorMutationRef = useRef(0);
  const loadedRef = useRef<LoadedLog | null>(null);
  const dateRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);

  useEffect(() => {
    dateRef.current = date;
  }, [date]);

  useEffect(() => {
    if (!uid || !date) {
      return;
    }

    const seq = ++loadSeqRef.current;

    (async () => {
      try {
        const result = await getDailyLog(uid, date);
        // 최신 selectedDate 요청만 반영 (빠른 날짜 전환 race 방지)
        if (seq !== loadSeqRef.current) {
          return;
        }
        setLoaded({ date, log: result });
        setLoadErrorState(null);
      } catch (caught) {
        if (seq !== loadSeqRef.current) {
          return;
        }
        setLoadErrorState({ date, message: messageOf(caught) });
      }
    })();
  }, [uid, date]);

  const isLoadedForDate = loaded !== null && date !== undefined && loaded.date === date;
  const isErrorForDate =
    loadErrorState !== null && date !== undefined && loadErrorState.date === date;

  const log = isLoadedForDate ? loaded.log : null;
  const status: DailyLogStatus = isErrorForDate
    ? "error"
    : isLoadedForDate
      ? "ready"
      : "loading";
  const loadError = isErrorForDate ? loadErrorState.message : null;

  /**
   * 공통 mutation 실행기.
   * - 낙관적 업데이트 후 실패 시 롤백
   * - 오래된 요청의 성공이 최신 오류를 덮지 않게 mutation id 비교
   * - 시작 시점 date와 현재 date가 다르면 화면 상태는 건드리지 않음
   */
  const runMutation = useCallback(
    async (
      targetDate: string,
      optimistic: (prev: DailyLog | null) => DailyLog | null,
      persist: () => Promise<void>,
    ) => {
      const mutationId = ++mutationSeqRef.current;
      const prevLoaded = loadedRef.current;
      const appliedOptimistic =
        prevLoaded !== null && prevLoaded.date === targetDate;

      if (appliedOptimistic) {
        const nextLoaded: LoadedLog = {
          date: targetDate,
          log: optimistic(prevLoaded.log),
        };
        loadedRef.current = nextLoaded;
        setLoaded(nextLoaded);
      }
      setPendingCount((count) => count + 1);

      try {
        await persist();
        setHasSavedOnce(true);
        if (mutationId > lastErrorMutationRef.current) {
          setLastSaveError(null);
        }
      } catch (caught) {
        if (
          appliedOptimistic &&
          dateRef.current === targetDate &&
          loadedRef.current?.date === targetDate
        ) {
          loadedRef.current = prevLoaded;
          setLoaded(prevLoaded);
        }
        lastErrorMutationRef.current = mutationId;
        setLastSaveError(messageOf(caught));
      } finally {
        setPendingCount((count) => count - 1);
      }
    },
    [],
  );

  const baseLog = useCallback(
    (prev: DailyLog | null, targetDate: string): DailyLog =>
      prev ?? { date: targetDate },
    [],
  );

  const saveMealLog = useCallback(
    async (targetDate: string, slot: MealSlotType, mealLog: MealLog | null) => {
      if (!uid) {
        return;
      }
      await runMutation(
        targetDate,
        (prev) => {
          const next = { ...baseLog(prev, targetDate) };
          const meals = { ...(next.meals ?? {}) };
          if (mealLog === null) {
            delete meals[slot];
          } else {
            meals[slot] = mealLog;
          }
          next.meals = meals;
          return next;
        },
        () =>
          setMealLog(uid, targetDate, slot, mealLog, goalsSnapshot ?? undefined),
      );
    },
    [uid, runMutation, baseLog, goalsSnapshot],
  );

  const saveExtraFoods = useCallback(
    async (targetDate: string, foods: FoodEntry[]) => {
      if (!uid) {
        return;
      }
      await runMutation(
        targetDate,
        (prev) => ({ ...baseLog(prev, targetDate), extraFoods: foods }),
        () =>
          setExtraFoods(uid, targetDate, foods, goalsSnapshot ?? undefined),
      );
    },
    [uid, runMutation, baseLog, goalsSnapshot],
  );

  const addWater = useCallback(
    async (targetDate: string, deltaMl: number) => {
      if (!uid) {
        return;
      }
      await runMutation(
        targetDate,
        (prev) => {
          const base = baseLog(prev, targetDate);
          const current = base.waterMl ?? 0;
          return {
            ...base,
            waterMl: Math.min(WATER_MAX_ML, Math.max(0, current + deltaMl)),
          };
        },
        async () => {
          // 서버는 transaction으로 현재값 기준 증감 → 연속 클릭에도 유실 없음
          await addWaterMl(
            uid,
            targetDate,
            deltaMl,
            goalsSnapshot ?? undefined,
          );
        },
      );
    },
    [uid, runMutation, baseLog, goalsSnapshot],
  );

  const saveWater = useCallback(
    async (targetDate: string, valueMl: number) => {
      if (!uid) {
        return;
      }
      const clamped = Math.min(WATER_MAX_ML, Math.max(0, Math.round(valueMl)));
      await runMutation(
        targetDate,
        (prev) => ({ ...baseLog(prev, targetDate), waterMl: clamped }),
        () =>
          setWaterMl(uid, targetDate, clamped, goalsSnapshot ?? undefined),
      );
    },
    [uid, runMutation, baseLog, goalsSnapshot],
  );

  const saveSleep = useCallback(
    async (targetDate: string, hours: number | null) => {
      if (!uid) {
        return;
      }
      await runMutation(
        targetDate,
        (prev) => {
          const next = { ...baseLog(prev, targetDate) };
          if (hours === null) {
            delete next.sleepHours;
          } else {
            next.sleepHours = hours;
          }
          return next;
        },
        () =>
          setSleepHours(uid, targetDate, hours, goalsSnapshot ?? undefined),
      );
    },
    [uid, runMutation, baseLog, goalsSnapshot],
  );

  const saveWeight = useCallback(
    async (targetDate: string, weightKg: number | null) => {
      if (!uid) {
        return;
      }
      await runMutation(
        targetDate,
        (prev) => {
          const next = { ...baseLog(prev, targetDate) };
          if (weightKg === null) {
            delete next.weightKg;
          } else {
            next.weightKg = weightKg;
          }
          return next;
        },
        () =>
          setWeightKg(uid, targetDate, weightKg, goalsSnapshot ?? undefined),
      );
    },
    [uid, runMutation, baseLog, goalsSnapshot],
  );

  const saveCardioCompleted = useCallback(
    async (
      targetDate: string,
      session: CardioSession,
      planWeekStartDate: string,
      completed: boolean,
    ) => {
      if (!uid) {
        return;
      }
      await runMutation(
        targetDate,
        (prev) => ({
          ...baseLog(prev, targetDate),
          cardio: {
            planWeekStartDate,
            plannedSessionId: session.id,
            plannedType: session.type,
            plannedDurationMin: session.durationMin,
            completed,
            completedAt: completed ? new Date() : null,
          },
        }),
        () =>
          setCardioCompletion(
            uid,
            session,
            planWeekStartDate,
            completed,
            goalsSnapshot ?? undefined,
          ),
      );
    },
    [uid, runMutation, baseLog, goalsSnapshot],
  );

  const saveIndicator: SaveIndicator =
    pendingCount > 0
      ? "saving"
      : lastSaveError
        ? "error"
        : hasSavedOnce
          ? "saved"
          : "idle";

  return {
    log,
    status,
    loadError,
    saveIndicator,
    lastSaveError,
    saveMealLog,
    saveExtraFoods,
    addWater,
    saveWater,
    saveSleep,
    saveWeight,
    saveCardioCompleted,
  };
}

export interface TodaySnapshot {
  today: string;
  log: DailyLog | null;
  cardioPlan: WeeklyCardioPlan | null;
  loaded: boolean;
}

/**
 * 읽기 전용 오늘 스냅샷 (Dashboard·Instant 연동용).
 * 로컬 날짜 기준이며 listener 없이 1회 로드한다.
 */
export function useTodaySnapshot(uid: string | undefined): TodaySnapshot | null {
  const localWeek = useLocalWeek();
  const [snapshot, setSnapshot] = useState<TodaySnapshot | null>(null);
  const seqRef = useRef(0);

  const today = localWeek?.today;
  const weekStartDate = localWeek?.weekStartDate;

  useEffect(() => {
    if (!uid || !today || !weekStartDate) {
      return;
    }

    const seq = ++seqRef.current;

    (async () => {
      const [log, cardioPlan] = await Promise.all([
        getDailyLog(uid, today).catch(() => null),
        getWeeklyCardioPlan(uid, weekStartDate).catch(() => null),
      ]);
      if (seq !== seqRef.current) {
        return;
      }
      setSnapshot({ today, log, cardioPlan, loaded: true });
    })();
  }, [uid, today, weekStartDate]);

  return snapshot;
}
