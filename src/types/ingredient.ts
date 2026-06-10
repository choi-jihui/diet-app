export type IngredientStorage = "refrigerated" | "frozen" | "room_temperature";

export type IngredientPriority = "normal" | "use_soon";

export interface Ingredient {
  id: string;
  name: string;
  quantityText: string;
  category?: string;
  storage?: IngredientStorage;
  priority?: IngredientPriority;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface IngredientInput {
  name: string;
  quantityText: string;
  category?: string;
  storage?: IngredientStorage;
  priority?: IngredientPriority;
}

export type IngredientPatch = Partial<
  Pick<Ingredient, "name" | "quantityText" | "category" | "storage" | "priority">
>;

export interface ParsedIngredient {
  name: string;
  quantityText: string;
}
