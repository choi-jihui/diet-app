"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { getWeeklyMealPlan } from "@/lib/firebase/meal-plan-repo";
import {
  buildSingleDayPlanResponseSchema,
  buildWeeklyPlanResponseSchema,
  parseWeeklyPlanStreamEvent,
  STREAM_FORMAT_ERROR,
  type ParsedWeeklyPlanStreamEvent,
} from "@/lib/ai/schemas";
import { buildWeekDates } from "@/lib/utils/date";
import type { DailyPlan, WeeklyMealPlan } from "@/types/meal";
import type { NutritionTargets } from "@/types/nutrition";
import type { MealSlot, UserProfile } from "@/types/user";

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
const PARSE_ERROR =
  "식단을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.";

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

function sanitizePartialPlan(
  plan: unknown,
  fallback: {
    weekStartDate: string;
    unmanagedMealCalories: WeeklyMealPlan["unmanagedMealCalories"];
  },
): WeeklyMealPlan {
  if (!plan || typeof plan !== "object") {
    return {
      weekStartDate: fallback.weekStartDate,
      dailyPlans: [],
      shoppingSuggestions: [],
      unmanagedMealCalories: fallback.unmanagedMealCalories,
      safetyNote: "",
    };
  }

  const raw = plan as Record<string, unknown>;
  const unmanagedRaw = raw.unmanagedMealCalories;
  const unmanaged =
    unmanagedRaw &&
    typeof unmanagedRaw === "object" &&
    typeof (unmanagedRaw as { min?: unknown }).min === "number" &&
    typeof (unmanagedRaw as { max?: unknown }).max === "number" &&
    typeof (unmanagedRaw as { note?: unknown }).note === "string"
      ? (unmanagedRaw as WeeklyMealPlan["unmanagedMealCalories"])
      : fallback.unmanagedMealCalories;

  const dailyPlans = Array.isArray(raw.dailyPlans)
    ? raw.dailyPlans
        .filter((day): day is DailyPlan => Boolean(day) && typeof day === "object")
        .map((day) => ({
          ...day,
          meals: Array.isArray(day.meals)
            ? day.meals.filter((meal) => meal && typeof meal === "object")
            : [],
        }))
    : [];

  return {
    weekStartDate:
      typeof raw.weekStartDate === "string"
        ? raw.weekStartDate
        : fallback.weekStartDate,
    dailyPlans,
    shoppingSuggestions: Array.isArray(raw.shoppingSuggestions)
      ? raw.shoppingSuggestions.filter(
          (item) => item && typeof item === "object",
        )
      : [],
    unmanagedMealCalories: unmanaged,
    safetyNote: typeof raw.safetyNote === "string" ? raw.safetyNote : "",
  };
}

async function readStreamEvents(
  response: Response,
  onEvent: (event: ParsedWeeklyPlanStreamEvent) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(PARSE_ERROR);
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
      let raw: unknown;
      try {
        raw = JSON.parse(line);
      } catch {
        throw new Error(PARSE_ERROR);
      }
      onEvent(parseWeeklyPlanStreamEvent(raw));
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    let raw: unknown;
    try {
      raw = JSON.parse(buffer);
    } catch {
      throw new Error(PARSE_ERROR);
    }
    onEvent(parseWeeklyPlanStreamEvent(raw));
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
  const draftRef = useRef<WeeklyMealPlan | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const setPlanState = useCallback((next: WeeklyMealPlan | null) => {
    planRef.current = next;
    setPlan(next);
  }, []);

  const setDraftState = useCallback((next: WeeklyMealPlan | null) => {
    draftRef.current = next;
    setDraftPlan(next);
  }, []);

  const reload = useCallback(async () => {
    if (!uid) {
      return;
    }

    setStatus("loading");
    setError(null);
    setGeneratingProgress(null);
    setDraftState(null);

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
  }, [uid, weekStartDate, setPlanState, setDraftState]);

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
    async (args: GenerateArgs, options?: GenerateOptions) => {
      if (!uid || generatingRef.current) {
        return;
      }

      generatingRef.current = true;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const hadExistingPlan = Boolean(planRef.current);
      const selectedSlots = args.userProfile.selectedMealSlots as MealSlot[];
      const weekDates = buildWeekDates(weekStartDate);
      const weeklySchema = buildWeeklyPlanResponseSchema(
        weekStartDate,
        selectedSlots,
      );

      setStatus("generating");
      setError(null);
      setDraftState(null);
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
        let startContext: WeeklyMealPlan["unmanagedMealCalories"] | null = null;

        await readStreamEvents(response, (event) => {
          if (event.type === "start") {
            startContext = event.unmanagedMealCalories;
            setDraftState({
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
            const entry = weekDates[event.dayIndex];
            if (!entry) {
              throw new Error(STREAM_FORMAT_ERROR);
            }

            const daySchema = buildSingleDayPlanResponseSchema(
              entry.date,
              entry.dayLabel,
              selectedSlots,
            );
            const validated = daySchema.safeParse(event.dailyPlan);
            if (!validated.success) {
              console.error(
                "[useWeeklyPlan] day_schema_invalid",
                entry.date,
                JSON.stringify(validated.error.issues.slice(0, 10)),
              );
              throw new Error(STREAM_FORMAT_ERROR);
            }

            const prev = draftRef.current;
            const base: WeeklyMealPlan = prev ?? {
              weekStartDate,
              dailyPlans: [],
              shoppingSuggestions: [],
              unmanagedMealCalories:
                startContext ?? planRef.current?.unmanagedMealCalories ?? {
                  min: 0,
                  max: 0,
                  note: "",
                },
              safetyNote: "",
            };
            const dailyPlans = [...base.dailyPlans];
            dailyPlans[event.dayIndex] = validated.data;
            setDraftState({ ...base, dailyPlans });
            setGeneratingProgress({
              completed: event.dayIndex + 1,
              total: weekDates.length,
              currentLabel: validated.data.dayLabel,
            });
            options?.onDayComplete?.(event.dayIndex);
            return;
          }

          if (event.type === "meta") {
            const prev = draftRef.current;
            if (!prev) {
              return;
            }
            setDraftState({
              ...prev,
              shoppingSuggestions: event.shoppingSuggestions,
              safetyNote: event.safetyNote,
            });
            return;
          }

          if (event.type === "partial") {
            const unmanaged =
              startContext ??
              draftRef.current?.unmanagedMealCalories ??
              planRef.current?.unmanagedMealCalories ?? {
                min: 0,
                max: 0,
                note: "",
              };
            setDraftState(
              sanitizePartialPlan(event.plan, {
                weekStartDate,
                unmanagedMealCalories: unmanaged,
              }),
            );
            setGeneratingProgress({
              completed: event.completedDays,
              total: event.totalDays,
              currentLabel: labelForCompletedDays(event.completedDays),
            });
            return;
          }

          if (event.type === "done") {
            const validated = weeklySchema.safeParse(event.plan);
            if (!validated.success) {
              console.error(
                "[useWeeklyPlan] done_schema_invalid",
                JSON.stringify(validated.error.issues.slice(0, 10)),
              );
              throw new Error(STREAM_FORMAT_ERROR);
            }
            finalPlan = validated.data as WeeklyMealPlan;
            setPlanState(finalPlan);
            setDraftState(null);
            return;
          }

          if (event.type === "error") {
            throw new Error(event.message || GENERIC_ERROR);
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
        setDraftState(null);
        setStatus(hadExistingPlan ? "ready" : "error");
        setGeneratingProgress(null);
      } finally {
        window.clearTimeout(timeoutId);
        generatingRef.current = false;
      }
    },
    [uid, weekStartDate, setPlanState, setDraftState],
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
