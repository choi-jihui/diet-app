import type { GenerateJsonContentParams } from "@/lib/ai/gemini";

type JsonSchema = NonNullable<GenerateJsonContentParams["responseJsonSchema"]>;

export const WEEKLY_DAY_RESPONSE_JSON_SCHEMA: JsonSchema = {
  type: "object",
  required: ["date", "dayLabel", "meals", "coachNote"],
  properties: {
    date: { type: "string" },
    dayLabel: { type: "string" },
    coachNote: { type: "string" },
    meals: {
      type: "array",
      items: {
        type: "object",
        required: ["mealType", "targetCalories", "options"],
        properties: {
          mealType: { type: "string", enum: ["breakfast", "lunch", "dinner"] },
          targetCalories: { type: "number" },
          options: {
            type: "array",
            items: {
              type: "object",
              required: [
                "type",
                "title",
                "ingredients",
                "steps",
                "estimatedCalories",
                "estimatedProteinG",
                "prepMinutes",
                "why",
              ],
              properties: {
                type: {
                  type: "string",
                  enum: ["fat_loss", "filling", "lazy"],
                },
                title: { type: "string" },
                ingredients: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["name", "amount", "fromFridge"],
                    properties: {
                      name: { type: "string" },
                      amount: { type: "string" },
                      fromFridge: { type: "boolean" },
                    },
                  },
                },
                steps: { type: "array", items: { type: "string" } },
                estimatedCalories: { type: "number" },
                estimatedProteinG: { type: "number" },
                prepMinutes: { type: "number" },
                why: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};

export const WEEKLY_PLAN_FINAL_JSON_SCHEMA: JsonSchema = {
  type: "object",
  required: [
    "weekStartDate",
    "dailyPlans",
    "shoppingSuggestions",
    "unmanagedMealCalories",
    "safetyNote",
  ],
  properties: {
    weekStartDate: { type: "string" },
    dailyPlans: { type: "array", items: WEEKLY_DAY_RESPONSE_JSON_SCHEMA },
    shoppingSuggestions: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "reason", "priority"],
        properties: {
          name: { type: "string" },
          reason: { type: "string" },
          priority: { type: "string", enum: ["optional", "recommended"] },
        },
      },
    },
    unmanagedMealCalories: {
      type: "object",
      required: ["min", "max", "note"],
      properties: {
        min: { type: "number" },
        max: { type: "number" },
        note: { type: "string" },
      },
    },
    safetyNote: { type: "string" },
  },
};
