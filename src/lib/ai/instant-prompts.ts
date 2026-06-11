import { DEFAULT_PANTRY_STAPLES } from "@/lib/ai/fridge-only";
import type {
  InstantDiningRequest,
  InstantFridgeRequest,
  StoredIngredientDoc,
  StoredProfileDoc,
} from "@/lib/ai/instant-schemas";

export const INSTANT_FRIDGE_SYSTEM_PROMPT = `You are GAKK, a supportive Korean AI diet coach.
Rules:
- Reply in Korean.
- Return strict JSON only.
- Return exactly 3 recommendations that are clearly different.
- Use only allowed fridge ingredients and pantry staples.
- Pantry staples allowed: 물, 소금, 후추, 식용유.
- Never use allergy or disliked items.
- Use only available cooking tools.
- Calories and protein are estimates, not medical facts.
- Do not shame the user or guarantee weight loss.`;

export const INSTANT_DINING_SYSTEM_PROMPT = `You are GAKK, a supportive Korean AI diet coach.
Rules:
- Reply in Korean.
- Return strict JSON only.
- Return exactly 3 recommendations that are clearly different.
- Use calorie ranges, not exact guaranteed numbers.
- Do not use guilt-inducing language.
- Do not suggest skipping the next meal.
- Do not suggest compensating with punitive exercise.
- Provide supportive balance tips focused on protein, vegetables, and hydration.
- Do not provide medical diagnosis or treatment.`;

interface BuildFridgePromptParams {
  request: InstantFridgeRequest;
  profileDoc: StoredProfileDoc;
  ingredients: StoredIngredientDoc[];
}

interface BuildDiningPromptParams {
  request: InstantDiningRequest;
  profileDoc: StoredProfileDoc;
}

function printableIngredients(ingredients: StoredIngredientDoc[]): string {
  return ingredients
    .map((item) => (item.quantityText ? `${item.name}(${item.quantityText})` : item.name))
    .join(", ");
}

export function buildInstantFridgePrompt({
  request,
  profileDoc,
  ingredients,
}: BuildFridgePromptParams): string {
  const pantryList = DEFAULT_PANTRY_STAPLES.join(", ");
  const fridgeList = printableIngredients(ingredients);
  const preferred = request.preferredIngredients.join(", ") || "없음";
  const excluded = request.excludedIngredients.join(", ") || "없음";
  const allergies = profileDoc.profile.allergies.join(", ") || "없음";
  const dislikedFoods = profileDoc.profile.dislikedFoods.join(", ") || "없음";
  const cookingTools = profileDoc.profile.cookingTools.join(", ") || "기본 도구";

  return `사용자 즉시 식사 추천을 생성하세요.

mealSlot: ${request.mealSlot}
hungerLevel: ${request.hungerLevel}
maxPrepMinutes: ${request.maxPrepMinutes}
style: ${request.style}
preferredIngredients: ${preferred}
excludedIngredients: ${excluded}

user target calories: ${profileDoc.targets.targetCalories}
user protein goal: ${profileDoc.targets.proteinGoalG}
allergies: ${allergies}
disliked foods: ${dislikedFoods}
available tools: ${cookingTools}

allowed fridge ingredients:
${fridgeList}

strict constraints:
- 냉장고 재료와 기본 조리요소(${pantryList})만 허용.
- fromFridge=true는 냉장고 목록 재료만 사용.
- fromFridge=false는 기본 조리요소만 사용.
- excludedIngredients와 알레르기/비선호 음식은 절대 사용 금지.
- prepMinutes는 ${request.maxPrepMinutes} 이하.
- 결과 3개는 title, 구성, 조리법이 서로 달라야 함.
- steps는 1~3개, 각 한 문장으로 짧게.
- ingredients는 옵션당 최대 5개, why는 한 문장(최대 40자).
- JSON 문자열 안에 줄바꿈이나 큰따옴표를 넣지 말 것.

JSON:
{
  "recommendations": [
    {
      "title": "string",
      "ingredients": [{ "name": "string", "amount": "string", "fromFridge": true }],
      "steps": ["string"],
      "estimatedCalories": 450,
      "estimatedProteinG": 30,
      "prepMinutes": 10,
      "why": "string"
    }
  ]
}`;
}

export function buildInstantDiningPrompt({
  request,
  profileDoc,
}: BuildDiningPromptParams): string {
  const allergies = profileDoc.profile.allergies.join(", ") || "없음";
  const dislikedFoods = profileDoc.profile.dislikedFoods.join(", ") || "없음";

  return `사용자 외식/배달 추천을 생성하세요.

mealSlot: ${request.mealSlot}
category: ${request.category}
hungerLevel: ${request.hungerLevel}
remainingCalories: ${request.remainingCalories ?? "미입력"}

user target calories: ${profileDoc.targets.targetCalories}
user protein goal: ${profileDoc.targets.proteinGoalG}
allergies: ${allergies}
disliked foods: ${dislikedFoods}

rules:
- ${request.category} 카테고리에서 흔히 주문할 수 있는 대표 메뉴 3개를 직접 골라 추천.
- 결과는 정확히 3개, 서로 다른 메뉴.
- estimatedCaloriesRange는 반드시 min/max 범위로 제시.
- 메뉴를 금지하는 어조보다 주문/양 조절 팁 중심.
- 죄책감 유도 문구 금지.
- "다음 끼니 굶기", "칼로리 만회", "운동으로 태우기" 금지.
- balanceTip은 단백질/채소/수분 중심의 균형 팁으로 작성.
- 모든 문자열은 짧은 한국어 한 문장으로 작성. orderTips/portionTips는 각 1~2개만.

JSON:
{
  "recommendations": [
    {
      "menuName": "string",
      "category": "string",
      "estimatedCaloriesRange": { "min": 500, "max": 700 },
      "proteinEstimateG": 25,
      "orderTips": ["string"],
      "portionTips": ["string"],
      "why": "string",
      "balanceTip": "string"
    }
  ]
}`;
}
