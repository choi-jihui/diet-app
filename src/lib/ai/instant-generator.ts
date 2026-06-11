import { GeminiError, generateJsonContent } from "@/lib/ai/gemini";
import {
  buildInstantDiningPrompt,
  buildInstantFridgePrompt,
  INSTANT_DINING_SYSTEM_PROMPT,
  INSTANT_FRIDGE_SYSTEM_PROMPT,
} from "@/lib/ai/instant-prompts";
import {
  buildInstantFridgeResponseSchema,
  INSTANT_DINING_RESPONSE_JSON_SCHEMA,
  INSTANT_FRIDGE_RESPONSE_JSON_SCHEMA,
  instantDiningResponseSchema,
  type InstantDiningRequest,
  type InstantFridgeRequest,
  type InstantFridgeResponse,
  type StoredIngredientDoc,
  type StoredProfileDoc,
} from "@/lib/ai/instant-schemas";
import {
  buildAllowedIngredientKeys,
  buildPantryIngredientKeys,
  normalizeIngredientKey,
  validateFridgeOnlyInstantRecommendations,
} from "@/lib/ai/fridge-only";

const INSTANT_MAX_RETRY = 1;
// 2회 시도 합계가 lease(75초)와 maxDuration(90초) 안에 들어오도록 잡는다.
const FRIDGE_TIMEOUT_MS = 35_000;
const DINING_TIMEOUT_MS = 35_000;
// gemini 2.5/3.5 계열은 thinking 토큰이 maxOutputTokens에 포함되므로 여유 있게 잡는다.
const INSTANT_BASE_MAX_TOKENS = 4096;
const INSTANT_RETRY_MAX_TOKENS = 8192;

const BANNED_BALANCE_PATTERNS = [
  /굶/iu,
  /만회/iu,
  /태우/iu,
  /벌충/iu,
  /보상/iu,
  /운동.{0,8}소모/iu,
];

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function includesForbiddenBalancePhrase(value: string): boolean {
  return BANNED_BALANCE_PATTERNS.some((pattern) => pattern.test(value));
}

function validateForbiddenIngredients(
  recommendations: InstantFridgeResponse["recommendations"],
  profileDoc: StoredProfileDoc,
  excludedIngredients: string[],
): string[] {
  const forbiddenKeys = new Set(
    dedupe([
      ...profileDoc.profile.allergies,
      ...profileDoc.profile.dislikedFoods,
      ...excludedIngredients,
    ]).map((name) => normalizeIngredientKey(name)),
  );

  const violations = new Set<string>();
  for (const recommendation of recommendations) {
    for (const ingredient of recommendation.ingredients) {
      const key = normalizeIngredientKey(ingredient.name);
      if (key && forbiddenKeys.has(key)) {
        violations.add(ingredient.name);
      }
    }
  }
  return Array.from(violations);
}

function validatePreferredIngredientsSubset(
  fridgeIngredients: StoredIngredientDoc[],
  preferredIngredients: string[],
  excludedIngredients: string[],
): string[] {
  const allowedKeys = buildAllowedIngredientKeys(fridgeIngredients);
  const unknown = new Set<string>();

  for (const item of [...preferredIngredients, ...excludedIngredients]) {
    const key = normalizeIngredientKey(item);
    if (!key || !allowedKeys.has(key)) {
      unknown.add(item);
    }
  }

  return Array.from(unknown);
}

function mapGeminiErrorCode(error: GeminiError): string {
  switch (error.code) {
    case "timeout":
      return "GEMINI_TIMEOUT";
    case "invalid_json":
    case "truncated":
    case "empty_response":
      return "GEMINI_FORMAT_INVALID";
    case "http_error":
      return "GEMINI_HTTP_ERROR";
    case "missing_key":
      return "GEMINI_MISSING_KEY";
    default:
      return "GEMINI_ERROR";
  }
}

export class InstantGenerationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "InstantGenerationError";
    this.code = code;
  }
}

interface GenerateInstantFridgeParams {
  request: InstantFridgeRequest;
  profileDoc: StoredProfileDoc;
  ingredients: StoredIngredientDoc[];
  model?: string;
}

interface GenerateInstantDiningParams {
  request: InstantDiningRequest;
  profileDoc: StoredProfileDoc;
  model?: string;
}

export function validateSelectionAgainstFridge(
  ingredients: StoredIngredientDoc[],
  preferredIngredients: string[],
  excludedIngredients: string[],
): string[] {
  return validatePreferredIngredientsSubset(
    ingredients,
    dedupe(preferredIngredients),
    dedupe(excludedIngredients),
  );
}

export async function generateInstantFridgeRecommendations({
  request,
  profileDoc,
  ingredients,
  model,
}: GenerateInstantFridgeParams): Promise<InstantFridgeResponse["recommendations"]> {
  const requestPayload: InstantFridgeRequest = {
    ...request,
    preferredIngredients: dedupe(request.preferredIngredients),
    excludedIngredients: dedupe(request.excludedIngredients),
  };
  const responseSchema = buildInstantFridgeResponseSchema(requestPayload.maxPrepMinutes);
  const allowedFridgeKeys = buildAllowedIngredientKeys(ingredients);
  const pantryKeys = buildPantryIngredientKeys();

  let lastErrorCode = "UNKNOWN";
  let repairHint = "";

  for (let attempt = 0; attempt <= INSTANT_MAX_RETRY; attempt += 1) {
    const promptBase = buildInstantFridgePrompt({
      request: requestPayload,
      profileDoc,
      ingredients,
    });
    const repairPrompt =
      attempt === 0
        ? ""
        : `\n\n이전 응답 보정 지시:\n- 실패 원인: ${lastErrorCode}\n- 보정 포인트: ${
            repairHint || "스키마와 냉장고 제한을 정확히 지켜 주세요."
          }\n- 위반 재료를 제거하고 3개를 다시 생성하세요.`;

    try {
      const raw = await generateJsonContent({
        system: INSTANT_FRIDGE_SYSTEM_PROMPT,
        user: `${promptBase}${repairPrompt}`,
        model,
        maxOutputTokens:
          attempt === 0 ? INSTANT_BASE_MAX_TOKENS : INSTANT_RETRY_MAX_TOKENS,
        timeoutMs: FRIDGE_TIMEOUT_MS,
        responseJsonSchema: INSTANT_FRIDGE_RESPONSE_JSON_SCHEMA,
      });

      const parsed = responseSchema.safeParse(raw);
      if (!parsed.success) {
        lastErrorCode = "RESPONSE_SCHEMA_INVALID";
        repairHint = "필수 필드 누락 없이 정확한 JSON 구조를 맞춰 주세요.";
        continue;
      }

      const strictResult = validateFridgeOnlyInstantRecommendations(
        parsed.data.recommendations,
        allowedFridgeKeys,
        pantryKeys,
      );
      if (!strictResult.isValid) {
        lastErrorCode = "FRIDGE_STRICT_VIOLATION";
        repairHint = `허용되지 않은 재료: ${strictResult.unknownIngredients.join(", ")}`;
        continue;
      }

      const forbiddenViolations = validateForbiddenIngredients(
        parsed.data.recommendations,
        profileDoc,
        requestPayload.excludedIngredients,
      );
      if (forbiddenViolations.length > 0) {
        lastErrorCode = "FORBIDDEN_INGREDIENT_INCLUDED";
        repairHint = `금지 재료 포함: ${forbiddenViolations.join(", ")}`;
        continue;
      }

      return parsed.data.recommendations;
    } catch (caught) {
      if (caught instanceof GeminiError) {
        lastErrorCode = mapGeminiErrorCode(caught);
        repairHint = "JSON 형식과 정책을 지켜 다시 생성해 주세요.";
        continue;
      }

      throw new InstantGenerationError(
        "INSTANT_FRIDGE_FAILED",
        "추천을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
      );
    }
  }

  throw new InstantGenerationError(
    lastErrorCode,
    "냉장고 재료 기준을 맞춘 추천을 만들지 못했어요. 잠시 후 다시 시도해 주세요.",
  );
}

export async function generateInstantDiningRecommendations({
  request,
  profileDoc,
  model,
}: GenerateInstantDiningParams) {
  const requestPayload: InstantDiningRequest = request;

  let lastErrorCode = "UNKNOWN";
  let repairHint = "";

  for (let attempt = 0; attempt <= INSTANT_MAX_RETRY; attempt += 1) {
    const promptBase = buildInstantDiningPrompt({
      request: requestPayload,
      profileDoc,
    });
    const repairPrompt =
      attempt === 0
        ? ""
        : `\n\n이전 응답 보정 지시:\n- 실패 원인: ${lastErrorCode}\n- 보정 포인트: ${
            repairHint || "균형 팁 문구와 JSON 구조를 다시 확인해 주세요."
          }`;

    try {
      const raw = await generateJsonContent({
        system: INSTANT_DINING_SYSTEM_PROMPT,
        user: `${promptBase}${repairPrompt}`,
        model,
        maxOutputTokens:
          attempt === 0 ? INSTANT_BASE_MAX_TOKENS : INSTANT_RETRY_MAX_TOKENS,
        timeoutMs: DINING_TIMEOUT_MS,
        responseJsonSchema: INSTANT_DINING_RESPONSE_JSON_SCHEMA,
      });

      const parsed = instantDiningResponseSchema.safeParse(raw);
      if (!parsed.success) {
        lastErrorCode = "RESPONSE_SCHEMA_INVALID";
        repairHint = "필수 필드와 3개 메뉴 구조를 정확히 맞춰 주세요.";
        continue;
      }

      const hasBannedBalanceTip = parsed.data.recommendations.some((item) =>
        includesForbiddenBalancePhrase(item.balanceTip),
      );
      if (hasBannedBalanceTip) {
        lastErrorCode = "BALANCE_TIP_POLICY_VIOLATION";
        repairHint =
          "balanceTip은 다음 끼니 균형 팁으로만 작성하고, 굶기/만회/태우기 표현은 금지하세요.";
        continue;
      }

      return parsed.data.recommendations;
    } catch (caught) {
      if (caught instanceof GeminiError) {
        lastErrorCode = mapGeminiErrorCode(caught);
        repairHint = "JSON 형식과 문구 정책을 지켜 다시 생성해 주세요.";
        continue;
      }

      throw new InstantGenerationError(
        "INSTANT_DINING_FAILED",
        "외식 추천을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
      );
    }
  }

  throw new InstantGenerationError(
    lastErrorCode,
    "균형 잡힌 외식 추천을 만들지 못했어요. 잠시 후 다시 시도해 주세요.",
  );
}
