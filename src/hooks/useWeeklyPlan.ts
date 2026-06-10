"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { getWeeklyMealPlan } from "@/lib/firebase/meal-plan-repo";
import type { WeeklyPlanStreamEvent } from "@/lib/ai/stream-weekly-plan";
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

const GENERIC_ERROR =
  "식단을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
const TIMEOUT_ERROR =
  "시간이 조금 더 걸리고 있어요. 잠시 후 다시 시도해 주세요.";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : GENERIC_ERROR;
}

function labelForCompletedDays(count: number): string {
  if (count >= DAY_LABELS.length) {
    return "장보기";
  }
  return DAY_LABELS[count] ?? "월";
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
      try {
        onEvent(JSON.parse(line) as WeeklyPlanStreamEvent);
      } catch {
        throw new Error(GENERIC_ERROR);
      }
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    try {
      onEvent(JSON.parse(buffer) as WeeklyPlanStreamEvent);
    } catch {
      throw new Error(GENERIC_ERROR);
    }
  }
}

export function useWeeklyPlan(uid: string | undefined, weekStartDate: string) {
  const [plan, setPlan] = useState<WeeklyMealPlan | null>(null);
  const [draftPlan, setDraftPlan] = useState<WeeklyMealPlan | null>(null);
  const [status, setStatus] = useState<WeeklyPlanStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [generatingProgress, setGeneratingProgress] =
    useState<GeneratingProgress | null>(null);
  const generatingRef = useRef(false);
  const planRef = useRef<WeeklyMealPlan | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
    setDraftPlan(null);

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

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const generate = useCallback(
    async (args: GenerateArgs) => {
      if (!uid || generatingRef.current) {
        return;
      }

      generatingRef.current = true;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const hadExistingPlan = Boolean(planRef.current);
      setStatus("generating");
      setError(null);
      setDraftPlan(null);
      setGeneratingProgress({ completed: 0, total: 7, currentLabel: "월" });

      const timeoutId = window.setTimeout(() => controller.abort(), 240_000);

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
          signal: controller.signal,
        });

        const contentType = response.headers.get("content-type") ?? "";

        if (!response.ok) {
          if (contentType.includes("application/json")) {
            const data = (await response.json().catch(() => null)) as
              | { error?: string }
              | null;
            throw new Error(data?.error ?? GENERIC_ERROR);
          }
          throw new Error(GENERIC_ERROR);
        }

        if (!contentType.includes("application/x-ndjson")) {
          throw new Error(GENERIC_ERROR);
        }

        let finalPlan: WeeklyMealPlan | null = null;

        await readStreamEvents(response, (event) => {
          if (event.type === "start") {
            setDraftPlan({
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

          if (event.type === "partial") {
            setDraftPlan(event.plan);
            setGeneratingProgress({
              completed: event.completedDays,
              total: event.totalDays,
              currentLabel: labelForCompletedDays(event.completedDays),
            });
            return;
          }

          if (event.type === "done") {
            finalPlan = event.plan;
            setPlanState(event.plan);
            setDraftPlan(null);
            return;
          }

          if (event.type === "error") {
            throw new Error(event.message);
          }
        });

        if (!finalPlan) {
          throw new Error(GENERIC_ERROR);
        }

        setStatus("ready");
        setGeneratingProgress(null);
      } catch (caught) {
        const isTimeout =
          caught instanceof DOMException &&
          (caught.name === "TimeoutError" || caught.name === "AbortError");
        setError(isTimeout ? TIMEOUT_ERROR : messageOf(caught));
        setDraftPlan(null);
        setStatus(hadExistingPlan ? "ready" : "error");
        setGeneratingProgress(null);
      } finally {
        window.clearTimeout(timeoutId);
        generatingRef.current = false;
      }
    },
    [uid, weekStartDate, setPlanState],
  );

  return {
    plan,
    draftPlan,
    status,
    error,
    generatingProgress,
    generate,
    reload,
  };
}
