import type { GenerateWeeklyPlanRequest } from "@/lib/ai/schemas";
import { streamWeeklyMealPlan } from "@/lib/ai/weekly-plan-stream";
import type { WeeklyMealPlan } from "@/types/meal";
import type { MealSlot } from "@/types/user";

/** 비스트리밍 생성은 스트리밍 코어를 재사용한다. */
export async function generateWeeklyMealPlan(
  request: GenerateWeeklyPlanRequest,
  selectedSlots: MealSlot[],
): Promise<WeeklyMealPlan | null> {
  for await (const event of streamWeeklyMealPlan(request, selectedSlots)) {
    if (event.type === "done") {
      return event.plan;
    }
    if (event.type === "error") {
      return null;
    }
  }
  return null;
}
