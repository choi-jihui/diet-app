import { WeekPlanManager } from "@/components/diet/WeekPlanManager";

export function WeekPlanPanel({ onGoToFridge }: { onGoToFridge: () => void }) {
  return <WeekPlanManager onGoToFridge={onGoToFridge} />;
}
