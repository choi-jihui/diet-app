import {
  MEAL_SLOT_LABELS_KO,
  type SlotBudget,
} from "@/lib/ai/calorie-allocation";
import type { GenerateWeeklyPlanRequest } from "@/lib/ai/schemas";
import type { WeekDate } from "@/lib/utils/date";
import type { UnmanagedMealCalories } from "@/types/meal";

export const WEEKLY_PLAN_SYSTEM_PROMPT = `You are GAKK, a supportive Korean AI diet execution coach.
Rules:
- Reply in Korean.
- Return valid JSON only. No markdown, no commentary.
- Use fridge ingredients first; only suggest minimal shopping when needed.
- Never recommend allergic ingredients. Exclude disliked foods.
- Stay within the user's available cooking tools.
- Do not add many expensive special ingredients.
- Keep meals realistic for Korean home cooking.
- Calories and protein are estimates; do not claim precision.
- Avoid extreme low-calorie meals. Never guarantee weight loss. Never shame the user.
- Do not over-repeat the same menu across 7 days, but reasonable repetition to use up fridge items is fine.`;

interface BuildPromptParams {
  request: GenerateWeeklyPlanRequest;
  slotBudgets: SlotBudget[];
  weekDates: WeekDate[];
  unmanaged: UnmanagedMealCalories;
}

interface SingleDayPromptParams {
  request: GenerateWeeklyPlanRequest;
  slotBudgets: SlotBudget[];
  dayDate: string;
  dayLabel: string;
  dayIndex: number;
}

/** 하루치 식단만 생성한다. 출력을 짧게 유지해 속도와 JSON 안정성을 높인다. */
export function buildSingleDayPlanPrompt({
  request,
  slotBudgets,
  dayDate,
  dayLabel,
  dayIndex,
}: SingleDayPromptParams): string {
  const { userProfile, nutritionTargets, ingredients } = request;

  const ingredientList = ingredients
    .map((item) =>
      item.quantityText ? `${item.name}(${item.quantityText})` : item.name,
    )
    .join(", ");

  const budgetLines = slotBudgets
    .map(
      (entry) =>
        `${MEAL_SLOT_LABELS_KO[entry.slot]}: 약 ${entry.budget}kcal`,
    )
    .join(", ");

  const selectedSlots = userProfile.selectedMealSlots.join(", ");

  return `오늘(${dayLabel}, ${dayIndex + 1}/7) 하루 식단만 JSON으로 생성하세요.

사용자: ${userProfile.gender}, ${userProfile.age}세, 목표 ${nutritionTargets.targetCalories}kcal/일
알레르기: ${userProfile.allergies.join(", ") || "없음"}
싫어하는 음식: ${userProfile.dislikedFoods.join(", ") || "없음"}
조리도구: ${userProfile.cookingTools.join(", ") || "기본"}
냉장고: ${ingredientList}

관리 끼니: ${selectedSlots}
끼니 예산: ${budgetLines}

규칙:
- date="${dayDate}", dayLabel="${dayLabel}"
- meals는 ${selectedSlots}만, 각 1개
- 각 meal.options는 fat_loss, filling, lazy 각 1개
- ingredients는 옵션당 최대 5개, steps는 최대 3줄(짧게), why는 한 문장
- JSON 문자열 값 안에 큰따옴표(")나 줄바꿈을 넣지 말 것. 간단한 한국어 문장만
- 냉장고 재료 우선(fromFridge=true), 다른 요일과 메뉴 겹침 최소화

JSON:
{
  "date": "${dayDate}",
  "dayLabel": "${dayLabel}",
  "meals": [
    {
      "mealType": "breakfast | lunch | dinner",
      "targetCalories": 400,
      "options": [
        { "type": "fat_loss", "title": "string", "ingredients": [{ "name": "string", "amount": "string", "fromFridge": true }], "steps": ["string"], "estimatedCalories": 380, "estimatedProteinG": 25, "prepMinutes": 15, "why": "string" },
        { "type": "filling", "title": "string", "ingredients": [], "steps": [], "estimatedCalories": 420, "estimatedProteinG": 28, "prepMinutes": 20, "why": "string" },
        { "type": "lazy", "title": "string", "ingredients": [], "steps": [], "estimatedCalories": 390, "estimatedProteinG": 22, "prepMinutes": 8, "why": "string" }
      ]
    }
  ],
  "coachNote": "string"
}`;
}

interface WeekMetaPromptParams {
  request: GenerateWeeklyPlanRequest;
  dayTitles: string[];
}

/** 장보기 제안과 안전 안내만 짧게 생성한다. */
export function buildWeekMetaPrompt({
  request,
  dayTitles,
}: WeekMetaPromptParams): string {
  const ingredientList = request.ingredients
    .map((item) => item.name)
    .join(", ");

  return `이번 주 식단 메뉴: ${dayTitles.slice(0, 30).join(", ")}
냉장고 재료: ${ingredientList}

냉장고에 없고 추가하면 좋은 재료만 shoppingSuggestions(최대 8개)와 safetyNote(한 문장)를 JSON으로 반환하세요.
비싼 특수 식재료 남발 금지. 칼로리·단백질은 추정치임을 안내.

JSON:
{
  "shoppingSuggestions": [{ "name": "string", "reason": "string", "priority": "optional | recommended" }],
  "safetyNote": "string"
}`;
}

export function buildWeeklyPlanUserPrompt({
  request,
  slotBudgets,
  weekDates,
  unmanaged,
}: BuildPromptParams): string {
  const { userProfile, nutritionTargets, ingredients, weekStartDate } = request;

  const ingredientList = ingredients
    .map((item) =>
      item.quantityText ? `${item.name}(${item.quantityText})` : item.name,
    )
    .join(", ");

  const budgetLines = slotBudgets
    .map(
      (entry) =>
        `${MEAL_SLOT_LABELS_KO[entry.slot]}(${entry.slot}): 약 ${entry.budget}kcal`,
    )
    .join(", ");

  const days = weekDates
    .map((entry) => `${entry.date}(${entry.dayLabel})`)
    .join(", ");

  const selectedSlots = userProfile.selectedMealSlots.join(", ");

  return `사용자 정보:
- 성별 ${userProfile.gender}, 나이 ${userProfile.age}, 키 ${userProfile.heightCm}cm, 체중 ${userProfile.weightKg}kg, 목표 ${userProfile.goalWeightKg}kg
- 활동량 ${userProfile.activityLevel}, 식단 강도 ${userProfile.dietIntensity}
- 하루 목표 칼로리 ${nutritionTargets.targetCalories}kcal, 단백질 목표 ${nutritionTargets.proteinGoalG}g
- 알레르기: ${userProfile.allergies.join(", ") || "없음"}
- 싫어하는 음식: ${userProfile.dislikedFoods.join(", ") || "없음"}
- 조리도구: ${userProfile.cookingTools.join(", ") || "기본"}

냉장고 재료: ${ingredientList}

관리할 끼니: ${selectedSlots}
끼니별 칼로리 예산(하루 목표 기준, 미선택 끼니로 몰아주지 말 것): ${budgetLines}
비관리 끼니 여유 범위: ${unmanaged.min}~${unmanaged.max}kcal

7일 날짜: ${days}

요구사항:
- weekStartDate는 정확히 "${weekStartDate}".
- dailyPlans는 정확히 7개, 위 날짜 순서와 동일하게.
- 각 날짜 meals에는 관리할 끼니(${selectedSlots})만, 각 끼니당 1개.
- 각 meal.targetCalories는 위 끼니 예산에 맞춘다.
- 각 meal.options는 정확히 3개: type은 fat_loss(감량형), filling(든든형), lazy(귀찮은 날) 각각 1개.
- 각 option은 title, ingredients(name, amount, fromFridge), steps, estimatedCalories, estimatedProteinG, prepMinutes, why 포함.
- 냉장고에 있는 재료는 fromFridge=true.
- estimatedCalories는 해당 끼니 예산 근처의 현실적인 값.

JSON 스키마(이 구조와 키를 정확히 따를 것):
{
  "weekStartDate": "${weekStartDate}",
  "dailyPlans": [
    {
      "date": "YYYY-MM-DD",
      "dayLabel": "월",
      "meals": [
        {
          "mealType": "breakfast | lunch | dinner",
          "targetCalories": 400,
          "options": [
            { "type": "fat_loss", "title": "string", "ingredients": [ { "name": "string", "amount": "string", "fromFridge": true } ], "steps": ["string"], "estimatedCalories": 380, "estimatedProteinG": 25, "prepMinutes": 15, "why": "string" },
            { "type": "filling", "title": "string", "ingredients": [], "steps": [], "estimatedCalories": 420, "estimatedProteinG": 28, "prepMinutes": 20, "why": "string" },
            { "type": "lazy", "title": "string", "ingredients": [], "steps": [], "estimatedCalories": 390, "estimatedProteinG": 22, "prepMinutes": 8, "why": "string" }
          ]
        }
      ],
      "coachNote": "string"
    }
  ],
  "shoppingSuggestions": [ { "name": "string", "reason": "string", "priority": "optional | recommended" } ],
  "unmanagedMealCalories": { "min": ${unmanaged.min}, "max": ${unmanaged.max}, "note": "string" },
  "safetyNote": "string"
}`;
}
