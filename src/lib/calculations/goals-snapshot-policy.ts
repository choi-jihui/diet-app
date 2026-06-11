import type { DailyGoalsSnapshot } from "@/types/daily-log";

/**
 * goalsSnapshot 저장 정책 (Firestore transaction과 동일).
 * - 기존 snapshot 없음 + incoming 있음 → 1회 보충
 * - 기존 snapshot 있음 → 절대 덮어쓰지 않음
 */
export function patchPayloadWithGoalsSnapshot(
  existingSnapshot: DailyGoalsSnapshot | undefined,
  incomingSnapshot: DailyGoalsSnapshot | undefined,
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const payload = { ...fields };

  if (!existingSnapshot && incomingSnapshot) {
    payload.goalsSnapshot = {
      targetCalories: incomingSnapshot.targetCalories,
      waterGoalMl: incomingSnapshot.waterGoalMl,
      proteinGoalG: incomingSnapshot.proteinGoalG,
      managedMealSlots: [...incomingSnapshot.managedMealSlots],
    };
  }

  return payload;
}
