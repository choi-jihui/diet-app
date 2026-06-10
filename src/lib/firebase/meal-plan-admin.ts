import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { MEAL_PLAN_SCHEMA_VERSION } from "@/lib/firebase/meal-plan-repo";
import type { WeeklyMealPlan } from "@/types/meal";

const SAVE_ERROR = "식단을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

/** 서버(Admin SDK)에서만 식단을 저장한다. 클라이언트 저장은 사용하지 않는다. */
export async function saveWeeklyMealPlanAdmin(
  uid: string,
  plan: WeeklyMealPlan,
): Promise<void> {
  try {
    const ref = getAdminDb().doc(
      `users/${uid}/mealPlans/${plan.weekStartDate}`,
    );
    const existing = await ref.get();

    const base = {
      plan,
      schemaVersion: MEAL_PLAN_SCHEMA_VERSION,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (existing.exists) {
      await ref.set(base, { merge: true });
    } else {
      await ref.set({ ...base, createdAt: FieldValue.serverTimestamp() });
    }
  } catch {
    throw new Error(SAVE_ERROR);
  }
}
