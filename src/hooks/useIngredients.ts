"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addIngredients,
  deleteIngredient,
  listIngredients,
  updateIngredient,
} from "@/lib/firebase/ingredient-repo";
import type {
  Ingredient,
  IngredientInput,
  IngredientPatch,
} from "@/types/ingredient";

export type IngredientsStatus = "loading" | "ready" | "error";

function messageOf(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
}

export function useIngredients(uid: string | undefined) {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [status, setStatus] = useState<IngredientsStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) {
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const list = await listIngredients(uid);
      setItems(list);
      setStatus("ready");
    } catch (caught) {
      setError(messageOf(caught));
      setStatus("error");
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      return;
    }

    let active = true;

    (async () => {
      try {
        const list = await listIngredients(uid);
        if (active) {
          setItems(list);
          setError(null);
          setStatus("ready");
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
  }, [uid]);

  const addMany = useCallback(
    async (inputs: IngredientInput[]) => {
      if (!uid || inputs.length === 0) {
        return;
      }

      await addIngredients(uid, inputs);
      await reload();
    },
    [uid, reload],
  );

  const update = useCallback(
    async (ingredientId: string, patch: IngredientPatch) => {
      if (!uid) {
        return;
      }

      const previous = items;
      setItems(
        previous.map((item) =>
          item.id === ingredientId ? { ...item, ...patch } : item,
        ),
      );

      try {
        await updateIngredient(uid, ingredientId, patch);
      } catch (caught) {
        setItems(previous);
        throw caught;
      }
    },
    [uid, items],
  );

  const remove = useCallback(
    async (ingredientId: string) => {
      if (!uid) {
        return;
      }

      const previous = items;
      setItems(previous.filter((item) => item.id !== ingredientId));

      try {
        await deleteIngredient(uid, ingredientId);
      } catch (caught) {
        setItems(previous);
        throw caught;
      }
    },
    [uid, items],
  );

  return { items, status, error, reload, addMany, update, remove };
}
