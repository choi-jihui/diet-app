import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type CollectionReference,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import type {
  Ingredient,
  IngredientInput,
  IngredientPatch,
} from "@/types/ingredient";

const AUTH_ERROR = "로그인이 필요해요. 다시 로그인해 주세요.";
const LOAD_ERROR = "재료를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
const SAVE_ERROR = "재료를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
const UPDATE_ERROR = "수정하지 못했어요. 잠시 후 다시 시도해 주세요.";
const DELETE_ERROR = "삭제하지 못했어요. 잠시 후 다시 시도해 주세요.";

function requireUid(uid: string): void {
  const current = getFirebaseAuth().currentUser;
  if (!current || current.uid !== uid) {
    throw new Error(AUTH_ERROR);
  }
}

function ingredientsCollection(uid: string): CollectionReference {
  return collection(getFirebaseDb(), "users", uid, "ingredients");
}

function cleanInput(input: IngredientInput): Record<string, unknown> {
  const data: Record<string, unknown> = {
    name: input.name,
    quantityText: input.quantityText,
  };

  if (input.category) data.category = input.category;
  if (input.storage) data.storage = input.storage;
  if (input.priority) data.priority = input.priority;

  return data;
}

function cleanPatch(patch: IngredientPatch): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (patch.name !== undefined) data.name = patch.name;
  if (patch.quantityText !== undefined) data.quantityText = patch.quantityText;
  if (patch.category !== undefined) data.category = patch.category;
  if (patch.storage !== undefined) data.storage = patch.storage;
  if (patch.priority !== undefined) data.priority = patch.priority;

  return data;
}

function createdAtSeconds(item: Ingredient): number {
  const value = item.createdAt as { seconds?: number } | undefined;
  return value && typeof value.seconds === "number" ? value.seconds : 0;
}

function sortIngredients(items: Ingredient[]): Ingredient[] {
  return [...items].sort((a, b) => {
    const aPriority = a.priority === "use_soon" ? 0 : 1;
    const bPriority = b.priority === "use_soon" ? 0 : 1;
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    return createdAtSeconds(b) - createdAtSeconds(a);
  });
}

export async function listIngredients(uid: string): Promise<Ingredient[]> {
  requireUid(uid);

  try {
    const snapshot = await getDocs(ingredientsCollection(uid));
    const items = snapshot.docs.map((entry) => ({
      id: entry.id,
      ...(entry.data() as Omit<Ingredient, "id">),
    }));
    return sortIngredients(items);
  } catch {
    throw new Error(LOAD_ERROR);
  }
}

export async function addIngredient(
  uid: string,
  input: IngredientInput,
): Promise<Ingredient> {
  requireUid(uid);

  try {
    const payload = cleanInput(input);
    const ref = await addDoc(ingredientsCollection(uid), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id, ...payload } as Ingredient;
  } catch {
    throw new Error(SAVE_ERROR);
  }
}

export async function addIngredients(
  uid: string,
  inputs: IngredientInput[],
): Promise<void> {
  requireUid(uid);

  if (inputs.length === 0) {
    return;
  }

  try {
    const batch = writeBatch(getFirebaseDb());
    const col = ingredientsCollection(uid);

    for (const input of inputs) {
      const ref = doc(col);
      batch.set(ref, {
        ...cleanInput(input),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch {
    throw new Error(SAVE_ERROR);
  }
}

export async function updateIngredient(
  uid: string,
  ingredientId: string,
  patch: IngredientPatch,
): Promise<void> {
  requireUid(uid);

  try {
    await updateDoc(doc(ingredientsCollection(uid), ingredientId), {
      ...cleanPatch(patch),
      updatedAt: serverTimestamp(),
    });
  } catch {
    throw new Error(UPDATE_ERROR);
  }
}

export async function deleteIngredient(
  uid: string,
  ingredientId: string,
): Promise<void> {
  requireUid(uid);

  try {
    await deleteDoc(doc(ingredientsCollection(uid), ingredientId));
  } catch {
    throw new Error(DELETE_ERROR);
  }
}
