import { NextResponse } from "next/server";
import {
  generateInstantDiningRecommendations,
  InstantGenerationError,
} from "@/lib/ai/instant-generator";
import {
  instantDiningRequestSchema,
  storedProfileDocSchema,
} from "@/lib/ai/instant-schemas";
import {
  getStoredProfileDocAdmin,
  isAdminConfigured,
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

  const parsedRequest = instantDiningRequestSchema.safeParse(body);
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

  const input = parsedRequest.data;

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

    const recommendations = await generateInstantDiningRecommendations({
      request: input,
      profileDoc: parsedProfileDoc.data,
    });
    rollbackUsage = false;

    return NextResponse.json({ recommendations });
  } catch (caught) {
    if (caught instanceof InstantGenerationError) {
      return errorResponse(502, GENERIC_ERROR, caught.code);
    }
    return errorResponse(500, GENERIC_ERROR, "INSTANT_DINING_FAILED");
  } finally {
    if (leaseReserved) {
      await releaseInstantRecommendationLease(uid, dateKey, requestId, {
        rollbackUsage,
      });
    }
  }
}
