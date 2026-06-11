import type { DailyPlan } from "@/types/meal";

export const DEFAULT_PANTRY_STAPLES = [
  "물",
  "소금",
  "후추",
  "식용유",
] as const;

const UNIT_SUFFIXES = ["캔", "통", "팩"] as const;

function stripKnownSuffix(value: string): string {
  for (const suffix of UNIT_SUFFIXES) {
    if (value.endsWith(suffix) && value.length > suffix.length) {
      return value.slice(0, -suffix.length).trim();
    }
  }
  return value;
}

export function normalizeIngredientKey(name: string): string {
  const trimmed = name.trim().toLowerCase();
  const normalized = stripKnownSuffix(trimmed);
  return normalized.replace(/\s+/g, "");
}

export function buildAllowedIngredientKeys(
  fridgeIngredients: Array<{ name: string }>,
): Set<string> {
  return new Set(
    fridgeIngredients
      .map((item) => normalizeIngredientKey(item.name))
      .filter(Boolean),
  );
}

export function buildPantryIngredientKeys(): Set<string> {
  return new Set(DEFAULT_PANTRY_STAPLES.map((name) => normalizeIngredientKey(name)));
}

export interface FridgeValidationResult {
  isValid: boolean;
  unknownIngredients: string[];
}

export function validateFridgeOnlyDayPlan(
  dailyPlan: DailyPlan,
  allowedFridgeKeys: Set<string>,
  pantryKeys: Set<string>,
): FridgeValidationResult {
  const unknown = new Set<string>();

  for (const meal of dailyPlan.meals) {
    for (const option of meal.options) {
      for (const ingredient of option.ingredients) {
        const key = normalizeIngredientKey(ingredient.name);
        if (!key) {
          unknown.add(ingredient.name);
          continue;
        }
        if (ingredient.fromFridge) {
          if (!allowedFridgeKeys.has(key)) {
            unknown.add(ingredient.name);
          }
          continue;
        }
        if (!pantryKeys.has(key)) {
          unknown.add(ingredient.name);
        }
      }
    }
  }

  return {
    isValid: unknown.size === 0,
    unknownIngredients: Array.from(unknown).slice(0, 12),
  };
}
