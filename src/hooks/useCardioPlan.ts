"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  buildWeeklyCardioSessions,
  type BuildCardioPlanInput,
  type BuildCardioPlanResult,
} from "@/lib/calculations/cardio-plan";
import {
  getWeeklyCardioPlan,
  saveWeeklyCardioPlan,
} from "@/lib/firebase/cardio-repo";
import {
  getCardioLogsByDates,
  setCardioCompletion,
} from "@/lib/firebase/daily-log-repo";
import { formatYmd, getWeekStartDate } from "@/lib/utils/date";
import type {
  CardioSession,
  DailyLogCardio,
  WeeklyCardioPlan,
} from "@/types/cardio";
import type { DailyGoalsSnapshot } from "@/types/daily-log";

const GENERIC_ERROR = "문제가 생겼어요. 잠시 후 다시 시도해 주세요.";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : GENERIC_ERROR;
}

const noopSubscribe = () => () => {};

/**
 * 브라우저 로컬 날짜 기준 today/weekStartDate.
 * 서버 스냅샷은 null이라 정적 prerender와 hydration이 충돌하지 않는다.
 */
export function useLocalWeek(): { today: string; weekStartDate: string } | null {
  const today = useSyncExternalStore(
    noopSubscribe,
    () => formatYmd(new Date()),
    () => null,
  );
  const weekStartDate = useSyncExternalStore(
    noopSubscribe,
    () => getWeekStartDate(),
    () => null,
  );

  if (!today || !weekStartDate) {
    return null;
  }
  return { today, weekStartDate };
}

export type CardioPlanStatus = "loading" | "empty" | "ready" | "error";

export function useCardioPlan(
  uid: string | undefined,
  weekStartDate: string | undefined,
) {
  const [status, setStatus] = useState<CardioPlanStatus>("loading");
  const [plan, setPlan] = useState<WeeklyCardioPlan | null>(null);
  const [cardioLogs, setCardioLogs] = useState<
    Record<string, DailyLogCardio | null>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!uid || !weekStartDate) {
      return;
    }

    let active = true;

    (async () => {
      try {
        const loaded = await getWeeklyCardioPlan(uid, weekStartDate);
        if (!active) {
          return;
        }

        if (!loaded) {
          setPlan(null);
          setCardioLogs({});
          setStatus("empty");
          return;
        }

        const logs = await getCardioLogsByDates(
          uid,
          loaded.sessions.map((session) => session.date),
        );
        if (!active) {
          return;
        }

        setPlan(loaded);
        setCardioLogs(logs);
        setStatus("ready");
      } catch (caught) {
        if (active) {
          setError(messageOf(caught));
          setStatus("error");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [uid, weekStartDate]);

  const generate = useCallback(
    async (input: BuildCardioPlanInput): Promise<BuildCardioPlanResult> => {
      if (!uid || saving) {
        return { ok: false, reason: "no_cardio" };
      }

      const built = buildWeeklyCardioSessions(input);
      if (!built.ok) {
        return built;
      }

      setSaving(true);
      setError(null);
      try {
        await saveWeeklyCardioPlan(uid, {
          weekStartDate: built.weekStartDate,
          settings: built.settings,
          sessions: built.sessions,
        });

        const logs = await getCardioLogsByDates(
          uid,
          built.sessions.map((session) => session.date),
        );

        setPlan({
          weekStartDate: built.weekStartDate,
          settings: built.settings,
          sessions: built.sessions,
        });
        setCardioLogs(logs);
        setStatus("ready");
        return built;
      } catch (caught) {
        setError(messageOf(caught));
        return { ok: false, reason: "no_cardio" };
      } finally {
        setSaving(false);
      }
    },
    [uid, saving],
  );

  const toggleCompletion = useCallback(
    async (
      session: CardioSession,
      completed: boolean,
      goalsSnapshot?: DailyGoalsSnapshot,
    ) => {
      if (!uid || !plan) {
        return;
      }

      setError(null);
      try {
        await setCardioCompletion(
          uid,
          session,
          plan.weekStartDate,
          completed,
          goalsSnapshot,
        );
        setCardioLogs((prev) => ({
          ...prev,
          [session.date]: {
            planWeekStartDate: plan.weekStartDate,
            plannedSessionId: session.id,
            plannedType: session.type,
            plannedDurationMin: session.durationMin,
            completed,
            completedAt: completed ? new Date() : null,
          },
        }));
      } catch (caught) {
        setError(messageOf(caught));
      }
    },
    [uid, plan],
  );

  return {
    status,
    plan,
    cardioLogs,
    error,
    saving,
    generate,
    toggleCompletion,
  };
}
