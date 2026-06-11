import { NextResponse } from "next/server";
import { generateWeeklyPlanRequestSchema } from "@/lib/ai/schemas";
import {
  streamWeeklyPlanSingleCall,
  type WeeklyPlanStreamEvent,
} from "@/lib/ai/stream-weekly-plan";
import {
  isAdminConfigured,
  releaseWeeklyPlanGeneration,
  reserveWeeklyPlanGeneration,
  verifyIdToken,
} from "@/lib/firebase/admin";
import { saveWeeklyMealPlanAdmin } from "@/lib/firebase/meal-plan-admin";
import { formatYmd } from "@/lib/utils/date";
import type { MealSlot } from "@/types/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GENERIC_ERROR =
  "식단을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.";

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

async function collectFinalPlan(
  request: Parameters<typeof streamWeeklyPlanSingleCall>[0],
  selectedSlots: MealSlot[],
) {
  for await (const event of streamWeeklyPlanSingleCall(request, selectedSlots)) {
    if (event.type === "done") {
      return event.plan;
    }
    if (event.type === "error") {
      return null;
    }
  }
  return null;
}

export async function POST(request: Request) {
  const wantsStream =
    request.headers.get("accept")?.includes("application/x-ndjson") ?? false;

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    return errorResponse(401, "로그인이 필요해요. 다시 로그인해 주세요.");
  }

  if (!isAdminConfigured()) {
    console.error("[generate-weekly-plan] admin_not_configured");
    return errorResponse(500, GENERIC_ERROR);
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

  const parsed = generateWeeklyPlanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "요청 정보를 확인해 주세요.");
  }

  const input = parsed.data;
  const selectedSlots = uniqueStrings(input.userProfile.selectedMealSlots) as MealSlot[];

  const cleanedRequest = {
    ...input,
    userProfile: {
      ...input.userProfile,
      selectedMealSlots: selectedSlots,
      allergies: uniqueStrings(input.userProfile.allergies),
      dislikedFoods: uniqueStrings(input.userProfile.dislikedFoods),
      cookingTools: uniqueStrings(input.userProfile.cookingTools),
    },
  };

  const dateKey = formatYmd(new Date());
  let reservation: { allowed: boolean };
  try {
    reservation = await reserveWeeklyPlanGeneration(uid, dateKey);
  } catch {
    console.error("[generate-weekly-plan] usage_reserve_failed");
    return errorResponse(500, GENERIC_ERROR);
  }

  if (!reservation.allowed) {
    return errorResponse(
      429,
      "오늘은 식단 생성 횟수를 모두 사용했어요. 내일 다시 시도해 주세요.",
    );
  }

  if (!wantsStream) {
    const plan = await collectFinalPlan(cleanedRequest, selectedSlots);
    if (!plan) {
      await releaseWeeklyPlanGeneration(uid, dateKey);
      return errorResponse(502, GENERIC_ERROR);
    }

    try {
      await saveWeeklyMealPlanAdmin(uid, plan);
    } catch (caught) {
      console.error("[generate-weekly-plan] save_failed", caught);
      await releaseWeeklyPlanGeneration(uid, dateKey);
      return errorResponse(500, GENERIC_ERROR);
    }

    return NextResponse.json({ plan });
  }

  const encoder = new TextEncoder();
  let failed = false;

  const stream = new ReadableStream({
    async start(controller) {
      let streamClosed = false;

      const send = (event: WeeklyPlanStreamEvent): boolean => {
        if (streamClosed) {
          return false;
        }
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          return true;
        } catch {
          streamClosed = true;
          return false;
        }
      };

      try {
        for await (const event of streamWeeklyPlanSingleCall(
          cleanedRequest,
          selectedSlots,
        )) {
          if (event.type === "done") {
            try {
              await saveWeeklyMealPlanAdmin(uid, event.plan);
              if (!send(event)) {
                break;
              }
            } catch (caught) {
              failed = true;
              console.error("[generate-weekly-plan] save_failed", caught);
              send({
                type: "error",
                code: "SAVE_FAILED",
                message: GENERIC_ERROR,
              });
            }
            break;
          }

          if (!send(event)) {
            break;
          }

          if (event.type === "error") {
            failed = true;
            break;
          }
        }
      } catch (caught) {
        failed = true;
        console.error(
          "[generate-weekly-plan] stream_unhandled",
          caught instanceof Error ? caught.message : "unknown",
        );
        send({
          type: "error",
          code: "UPSTREAM_ERROR",
          message: GENERIC_ERROR,
        });
      }

      if (failed) {
        await releaseWeeklyPlanGeneration(uid, dateKey);
      }

      if (!streamClosed) {
        try {
          controller.close();
        } catch {
          // no-op
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
