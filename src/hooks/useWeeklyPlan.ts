"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import {
  getWeeklyMealPlan,
  saveWeeklyMealPlan,
} from "@/lib/firebase/meal-plan-repo";
import type { WeeklyPlanStreamEvent } from "@/lib/ai/weekly-plan-stream";
import type { WeeklyMealPlan } from "@/types/meal";
import type { NutritionTargets } from "@/types/nutrition";
import type { UserProfile } from "@/types/user";

export type WeeklyPlanStatus =
  | "loading"
  | "empty"
  | "ready"
  | "generating"
  | "error";

export interface GeneratingProgress {
  completed: number;
  total: number;
  currentLabel: string;
}

export interface GenerateArgs {
  userProfile: UserProfile;
  nutritionTargets: NutritionTargets;
  ingredients: { name: string; quantityText: string }[];
}

export interface GenerateOptions {
  onDayComplete?: (dayIndex: number) => void;
}

const GENERIC_ERROR =
  "식단을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
const TIMEOUT_ERROR =
  "시간이 조금 더 걸리고 있어요. 잠시 후 다시 시도해 주세요.";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : GENERIC_ERROR;
}

async function readStreamEvents(
  response: Response,
  onEvent: (event: WeeklyPlanStreamEvent) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(GENERIC_ERROR);
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      onEvent(JSON.parse(line) as WeeklyPlanStreamEvent);
    }
  }

  if (buffer.trim()) {
    onEvent(JSON.parse(buffer) as WeeklyPlanStreamEvent);
  }
}

export function useWeeklyPlan(uid: string | undefined, weekStartDate: string) {
  const [plan, setPlan] = useState<WeeklyMealPlan | null>(null);
  const [status, setStatus] = useState<WeeklyPlanStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [generatingProgress, setGeneratingProgress] =
    useState<GeneratingProgress | null>(null);
  const generatingRef = useRef(false);
  const planRef = useRef<WeeklyMealPlan | null>(null);

  const setPlanState = useCallback((next: WeeklyMealPlan | null) => {
    planRef.current = next;
    setPlan(next);
  }, []);

  const reload = useCallback(async () => {
    if (!uid) {
      return;
    }

    setStatus("loading");
    setError(null);
    setGeneratingProgress(null);

    try {
      const existing = await getWeeklyMealPlan(uid, weekStartDate);
      if (existing) {
        setPlanState(existing);
        setStatus("ready");
      } else {
        setPlanState(null);
        setStatus("empty");
      }
    } catch (caught) {
      setError(messageOf(caught));
      setStatus("error");
    }
  }, [uid, weekStartDate, setPlanState]);

  useEffect(() => {
    if (!uid) {
      return;
    }

    let active = true;

    (async () => {
      try {
        const existing = await getWeeklyMealPlan(uid, weekStartDate);
        if (!active) {
          return;
        }
        if (existing) {
          setPlanState(existing);
          setStatus("ready");
        } else {
          setPlanState(null);
          setStatus("empty");
        }
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
  }, [uid, weekStartDate, setPlanState]);

  const generate = useCallback(
    async (args: GenerateArgs, options?: GenerateOptions) => {
      if (!uid || generatingRef.current) {
        return;
      }

      generatingRef.current = true;
      setStatus("generating");
      setError(null);
      setPlanState(null);
      setGeneratingProgress({ completed: 0, total: 7, currentLabel: "월" });

      try {
        const token = await getFirebaseAuth().currentUser?.getIdToken();
        if (!token) {
          throw new Error("로그인이 필요해요. 다시 로그인해 주세요.");
        }

        const response = await fetch("/api/ai/generate-weekly-plan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/x-ndjson",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userProfile: args.userProfile,
            nutritionTargets: args.nutritionTargets,
            ingredients: args.ingredients,
            weekStartDate,
          }),
          signal: AbortSignal.timeout(240_000),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(data?.error ?? GENERIC_ERROR);
        }

        let finalPlan: WeeklyMealPlan | null = null;

        await readStreamEvents(response, (event) => {
          if (event.type === "start") {
            setPlanState({
              weekStartDate: event.weekStartDate,
              dailyPlans: [],
              shoppingSuggestions: [],
              unmanagedMealCalories: event.unmanagedMealCalories,
              safetyNote: "",
            });
            setGeneratingProgress({
              completed: 0,
              total: event.totalDays,
              currentLabel: "월",
            });
            return;
          }

          if (event.type === "progress") {
            setGeneratingProgress({
              completed: Math.min(event.dayIndex, event.totalDays),
              total: event.totalDays,
              currentLabel: event.dayLabel,
            });
            return;
          }

          if (event.type === "day") {
            setPlan((prev) => {
              if (!prev) {
                return prev;
              }
              const dailyPlans = [...prev.dailyPlans];
              dailyPlans[event.dayIndex] = event.dailyPlan;
              const next = { ...prev, dailyPlans };
              planRef.current = next;
              return next;
            });
            setGeneratingProgress({
              completed: event.dayIndex + 1,
              total: 7,
              currentLabel: event.dailyPlan.dayLabel,
            });
            options?.onDayComplete?.(event.dayIndex);
            return;
          }

          if (event.type === "meta") {
            setPlan((prev) => {
              if (!prev) {
                return prev;
              }
              const next = {
                ...prev,
                shoppingSuggestions: event.shoppingSuggestions,
                safetyNote: event.safetyNote,
              };
              planRef.current = next;
              return next;
            });
            return;
          }

          if (event.type === "done") {
            finalPlan = event.plan;
            setPlanState(event.plan);
            return;
          }

          if (event.type === "error") {
            throw new Error(event.message);
          }
        });

        if (!finalPlan) {
          throw new Error(GENERIC_ERROR);
        }

        await saveWeeklyMealPlan(uid, finalPlan);
        setStatus("ready");
        setGeneratingProgress(null);
      } catch (caught) {
        const isTimeout =
          caught instanceof DOMException && caught.name === "TimeoutError";
        setError(isTimeout ? TIMEOUT_ERROR : messageOf(caught));
        setStatus(planRef.current?.dailyPlans.length ? "ready" : "error");
        setGeneratingProgress(null);
      } finally {
        generatingRef.current = false;
      }
    },
    [uid, weekStartDate, setPlanState],
  );

  return { plan, status, error, generatingProgress, generate, reload };
}
