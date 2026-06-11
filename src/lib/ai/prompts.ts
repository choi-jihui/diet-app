import {
  MEAL_SLOT_LABELS_KO,
  type SlotBudget,
} from "@/lib/ai/calorie-allocation";
import { DEFAULT_PANTRY_STAPLES } from "@/lib/ai/fridge-only";
import type { DailySkeleton, GenerateWeeklyPlanRequest } from "@/lib/ai/schemas";
import type { WeekDate } from "@/lib/utils/date";
import type { UnmanagedMealCalories } from "@/types/meal";

export const WEEKLY_PLAN_SYSTEM_PROMPT = `You are GAKK, a supportive Korean AI diet execution coach.
Rules:
- Reply in Korean.
- Return valid JSON only. No markdown, no commentary.
- In fridge-only mode, use only allowed fridge ingredients and basic pantry staples.
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
  const pantryList = DEFAULT_PANTRY_STAPLES.join(", ");

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
- ingredients는 옵션당 최대 4개, steps는 1~2줄(짧게), why는 한 문장(최대 50자)
- JSON 문자열 값 안에 큰따옴표(")나 줄바꿈을 넣지 말 것. 간단한 한국어 문장만
- 냉장고 재료명은 입력 목록의 이름을 최대한 그대로 사용
- 냉장고 외 재료/구매 제안/대체 재료 제안 금지
- 메뉴 title에도 냉장고 외 재료명을 넣지 말 것
- fromFridge=true는 냉장고 재료에만 사용
- fromFridge=false는 기본 조리요소(${pantryList})만 허용

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

/** 1단계: 7일 골격(짧은 제목+영양 추정치)만 생성한다. */
export function buildWeeklySkeletonPrompt({
  request,
  slotBudgets,
  weekDates,
  unmanaged,
}: BuildPromptParams): string {
  const { userProfile, ingredients, weekStartDate } = request;
  const ingredientPreview = ingredients
    .slice(0, 24)
    .map((item) =>
      item.quantityText ? `${item.name}(${item.quantityText})` : item.name,
    )
    .join(", ");
  const ingredientList =
    ingredients.length > 24
      ? `${ingredientPreview} 외 ${ingredients.length - 24}개`
      : ingredientPreview;
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

  return `주간 식단 골격만 생성하세요.

기본:
- weekStartDate="${weekStartDate}"
- 날짜 7개: ${days}
- 관리 끼니: ${selectedSlots}
- 끼니 예산: ${budgetLines}
- 비관리 끼니 여유: ${unmanaged.min}~${unmanaged.max}kcal

제약:
- 알레르기 제외: ${userProfile.allergies.join(", ") || "없음"}
- 비선호 제외: ${userProfile.dislikedFoods.join(", ") || "없음"}
- 조리도구 반영: ${userProfile.cookingTools.join(", ") || "기본"}
- 냉장고 우선 활용: ${ingredientList}
- title은 50자 이하, 짧고 실용적
- options는 fat_loss/filling/lazy 각각 1개
- ingredients/steps/why/coachNote/shoppingSuggestions/safetyNote는 절대 포함 금지
- ${request.fridgeOnly ? "냉장고 전용 모드: 이후 상세 단계에서 냉장고 재료만 허용됨" : "냉장고 외 재료는 최소화"}
- JSON 외 텍스트 금지

반환 필드:
- weekStartDate
- dailyPlans[7]
  - date, dayLabel
  - meals[]: mealType, targetCalories
  - options[3]: type, title, estimatedCalories, estimatedProteinG, prepMinutes`;
}

/** 2단계: 골격을 고정한 채 상세(재료/조리법/이유/코치메모)만 채운다. */
export function buildDayDetailFromSkeletonPrompt(params: {
  request: GenerateWeeklyPlanRequest;
  skeletonDay: DailySkeleton;
  dayIndex: number;
}): string {
  const { request, skeletonDay, dayIndex } = params;
  const { userProfile, ingredients } = request;
  const pantryList = DEFAULT_PANTRY_STAPLES.join(", ");
  const ingredientList = ingredients
    .map((item) =>
      item.quantityText ? `${item.name}(${item.quantityText})` : item.name,
    )
    .join(", ");

  return `골격이 확정된 ${dayIndex + 1}/7 (${skeletonDay.dayLabel}) 식단에 상세만 채우세요.

중요: 아래 값은 절대 변경 금지
- date, dayLabel
- mealType
- 각 option.type
- title
- estimatedCalories
- estimatedProteinG
- prepMinutes

사용자 제약:
- 알레르기: ${userProfile.allergies.join(", ") || "없음"}
- 비선호: ${userProfile.dislikedFoods.join(", ") || "없음"}
- 조리도구: ${userProfile.cookingTools.join(", ") || "기본"}
- 냉장고 재료 우선 사용(fromFridge=true): ${ingredientList}

작성 규칙:
- 옵션별 ingredients 최대 4개
- 옵션별 steps는 정확히 1~2개
- why는 한 문장, 최대 50자
- coachNote는 최대 80자
- 짧고 실용적인 한국어, 수식어 과다 금지
- JSON 외 텍스트 금지
- 메뉴 title에도 냉장고 목록 밖 재료명을 넣지 말 것
- ${request.fridgeOnly ? `fromFridge=true는 냉장고 재료만 허용, fromFridge=false는 기본 조리요소(${pantryList})만 허용` : "냉장고 밖 재료는 필요한 경우에만 최소한으로 사용."}

골격(JSON):
${JSON.stringify(skeletonDay)}

반환 JSON:
{
  "date": "${skeletonDay.date}",
  "dayLabel": "${skeletonDay.dayLabel}",
  "meals": [
    {
      "mealType": "breakfast | lunch | dinner",
      "targetCalories": 400,
      "options": [
        { "type": "fat_loss", "title": "string", "ingredients": [{ "name": "string", "amount": "string", "fromFridge": true }], "steps": ["string"], "estimatedCalories": 380, "estimatedProteinG": 25, "prepMinutes": 15, "why": "string" },
        { "type": "filling", "title": "string", "ingredients": [], "steps": ["string"], "estimatedCalories": 420, "estimatedProteinG": 28, "prepMinutes": 20, "why": "string" },
        { "type": "lazy", "title": "string", "ingredients": [], "steps": ["string"], "estimatedCalories": 390, "estimatedProteinG": 22, "prepMinutes": 8, "why": "string" }
      ]
    }
  ],
  "coachNote": "string"
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
- ingredients는 옵션당 최대 4개, steps는 1~2줄(짧게), why는 한 문장(최대 50자).
- JSON 문자열 값 안에 큰따옴표(")나 줄바꿈을 넣지 말 것. 간단한 한국어 문장만.
- shoppingSuggestions는 최대 8개. 비싼 특수 식재료 남발 금지.

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
