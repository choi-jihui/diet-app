import { NextResponse } from "next/server";
import {
  generateInstantFridgeRecommendations,
  InstantGenerationError,
  validateSelectionAgainstFridge,
} from "@/lib/ai/instant-generator";
import {
  instantFridgeRequestSchema,
  storedIngredientsSchema,
  storedProfileDocSchema,
} from "@/lib/ai/instant-schemas";
import {
  getStoredProfileDocAdmin,
  isAdminConfigured,
  listStoredIngredientsAdmin,
  MAX_INSTANT_RECOMMENDATIONS_PER_DAY,
  releaseInstantRecommendationLease,
  reserveInstantRecommendationLease,
  verifyIdToken,
} from "@/lib/firebase/admin";
import { formatYmd } from "@/lib/utils/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const GENERIC_ERROR =
  "추천을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.";

function errorResponse(status: number, message: string, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function messageForInstantError(code: string): string {
  if (code === "FRIDGE_STRICT_VIOLATION") {
    return "냉장고 재료 기준을 맞춰 다시 추천하지 못했어요. 잠시 후 다시 시도해 주세요.";
  }
  if (code === "FORBIDDEN_INGREDIENT_INCLUDED") {
    return "제외 재료 조건을 맞춘 추천을 만들지 못했어요. 잠시 후 다시 시도해 주세요.";
  }
  return GENERIC_ERROR;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    return errorResponse(401, "로그인이 필요해요. 다시 로그인해 주세요.");
  }

  if (!isAdminConfigured()) {
    return errorResponse(500, GENERIC_ERROR, "ADMIN_NOT_CONFIGURED");
  }

  const uid = await verifyIdToken(token);
  if (!uid) {
    return errorResponse(401, "로그인이 만료됐어요. 다시 로그인해 주세요.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "요청 정보를 확인해 주세요.");
  }

  const parsedRequest = instantFridgeRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return errorResponse(400, "요청 정보를 확인해 주세요.");
  }

  const profileDocRaw = await getStoredProfileDocAdmin(uid);
  if (!profileDocRaw) {
    return errorResponse(
      400,
      "프로필 정보가 아직 없어요. 먼저 온보딩을 완료해 주세요.",
      "PROFILE_NOT_FOUND",
    );
  }

  const parsedProfileDoc = storedProfileDocSchema.safeParse(profileDocRaw);
  if (!parsedProfileDoc.success) {
    return errorResponse(
      400,
      "프로필 정보를 다시 확인해 주세요. 온보딩 화면에서 저장 후 다시 시도해 주세요.",
      "PROFILE_INVALID",
    );
  }

  const ingredientRaw = await listStoredIngredientsAdmin(uid);
  const parsedIngredients = storedIngredientsSchema.safeParse(ingredientRaw);
  if (!parsedIngredients.success || parsedIngredients.data.length === 0) {
    return errorResponse(
      400,
      "냉장고 재료가 비어 있어요. 재료를 먼저 추가해 주세요.",
      "INGREDIENTS_NOT_FOUND",
    );
  }

  const input = {
    ...parsedRequest.data,
    preferredIngredients: dedupe(parsedRequest.data.preferredIngredients),
    excludedIngredients: dedupe(parsedRequest.data.excludedIngredients),
  };
  const unknownSelections = validateSelectionAgainstFridge(
    parsedIngredients.data,
    input.preferredIngredients,
    input.excludedIngredients,
  );
  if (unknownSelections.length > 0) {
    return errorResponse(
      400,
      "냉장고에 있는 재료만 선택해 주세요.",
      "INGREDIENT_SELECTION_INVALID",
    );
  }

  const dateKey = formatYmd(new Date());
  const requestId = crypto.randomUUID();
  let leaseReserved = false;
  let rollbackUsage = true;

  try {
    const lease = await reserveInstantRecommendationLease(uid, dateKey, requestId);
    if (!lease.allowed) {
      if (lease.reason === "limit") {
        return errorResponse(
          429,
          `오늘 추천 ${MAX_INSTANT_RECOMMENDATIONS_PER_DAY}회를 모두 사용했어요. 내일 다시 시도해 주세요.`,
          "INSTANT_DAILY_LIMIT",
        );
      }
      return errorResponse(
        429,
        "이전 추천을 생성 중이에요. 잠시 후 다시 시도해 주세요.",
        "INSTANT_IN_PROGRESS",
      );
    }

    leaseReserved = true;

    const recommendations = await generateInstantFridgeRecommendations({
      request: input,
      profileDoc: parsedProfileDoc.data,
      ingredients: parsedIngredients.data,
    });
    rollbackUsage = false;

    return NextResponse.json({ recommendations });
  } catch (caught) {
    if (caught instanceof InstantGenerationError) {
      return errorResponse(502, messageForInstantError(caught.code), caught.code);
    }
    return errorResponse(500, GENERIC_ERROR, "INSTANT_FRIDGE_FAILED");
  } finally {
    if (leaseReserved) {
      await releaseInstantRecommendationLease(uid, dateKey, requestId, {
        rollbackUsage,
      });
    }
  }
}
