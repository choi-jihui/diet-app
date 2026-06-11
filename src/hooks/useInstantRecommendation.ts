"use client";

import { useCallback, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import type {
  InstantDiningRecommendation,
  InstantDiningRequestPayload,
  InstantFridgeRecommendation,
  InstantFridgeRequestPayload,
} from "@/types/instant";

type InstantStatus = "idle" | "loading" | "success" | "error";

interface InstantState<T> {
  status: InstantStatus;
  data: T[] | null;
  error: string | null;
}

const GENERIC_ERROR =
  "추천을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.";

const FRIDGE_CACHE_KEY = "gakk_instant_fridge_v1";
const DINING_CACHE_KEY = "gakk_instant_dining_v1";

function createInitialState<T>(): InstantState<T> {
  return { status: "idle", data: null, error: null };
}

function readCachedState<T>(storageKey: string): InstantState<T> {
  if (typeof window === "undefined") {
    return createInitialState<T>();
  }

  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) {
      return createInitialState<T>();
    }
    const parsed = JSON.parse(raw) as T[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return createInitialState<T>();
    }
    return { status: "success", data: parsed, error: null };
  } catch {
    sessionStorage.removeItem(storageKey);
    return createInitialState<T>();
  }
}

function extractErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return GENERIC_ERROR;
  }
  const data = payload as { error?: unknown };
  return typeof data.error === "string" && data.error.trim().length > 0
    ? data.error
    : GENERIC_ERROR;
}

async function getIdTokenOrThrow(): Promise<string> {
  const token = await getFirebaseAuth().currentUser?.getIdToken();
  if (!token) {
    throw new Error("로그인이 필요해요. 다시 로그인해 주세요.");
  }
  return token;
}

export function useInstantRecommendation() {
  const [fridgeState, setFridgeState] = useState<InstantState<InstantFridgeRecommendation>>(
    () => readCachedState<InstantFridgeRecommendation>(FRIDGE_CACHE_KEY),
  );
  const [diningState, setDiningState] = useState<InstantState<InstantDiningRecommendation>>(
    () => readCachedState<InstantDiningRecommendation>(DINING_CACHE_KEY),
  );

  const recommendFridge = useCallback(
    async (payload: InstantFridgeRequestPayload) => {
      setFridgeState((prev) => ({ ...prev, status: "loading", error: null }));
      try {
        const token = await getIdTokenOrThrow();
        const response = await fetch("/api/ai/instant-fridge", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = (await response.json().catch(() => null)) as
          | { recommendations?: InstantFridgeRecommendation[]; error?: string }
          | null;

        if (!response.ok) {
          throw new Error(extractErrorMessage(data));
        }

        const recommendations = Array.isArray(data?.recommendations)
          ? data.recommendations
          : [];
        setFridgeState({
          status: "success",
          data: recommendations,
          error: null,
        });
        sessionStorage.setItem(FRIDGE_CACHE_KEY, JSON.stringify(recommendations));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : GENERIC_ERROR;
        setFridgeState({ status: "error", data: null, error: message });
      }
    },
    [],
  );

  const recommendDining = useCallback(
    async (payload: InstantDiningRequestPayload) => {
      setDiningState((prev) => ({ ...prev, status: "loading", error: null }));
      try {
        const token = await getIdTokenOrThrow();
        const response = await fetch("/api/ai/instant-dining", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = (await response.json().catch(() => null)) as
          | { recommendations?: InstantDiningRecommendation[]; error?: string }
          | null;

        if (!response.ok) {
          throw new Error(extractErrorMessage(data));
        }

        const recommendations = Array.isArray(data?.recommendations)
          ? data.recommendations
          : [];
        setDiningState({
          status: "success",
          data: recommendations,
          error: null,
        });
        sessionStorage.setItem(DINING_CACHE_KEY, JSON.stringify(recommendations));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : GENERIC_ERROR;
        setDiningState({ status: "error", data: null, error: message });
      }
    },
    [],
  );

  const clearFridgeState = useCallback(() => {
    setFridgeState(createInitialState<InstantFridgeRecommendation>());
    sessionStorage.removeItem(FRIDGE_CACHE_KEY);
  }, []);

  const clearDiningState = useCallback(() => {
    setDiningState(createInitialState<InstantDiningRecommendation>());
    sessionStorage.removeItem(DINING_CACHE_KEY);
  }, []);

  return {
    fridgeState,
    diningState,
    recommendFridge,
    recommendDining,
    clearFridgeState,
    clearDiningState,
  };
}
