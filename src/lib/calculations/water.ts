export function calculateWaterGoalMl(weightKg: number): number {
  if (weightKg <= 0) {
    throw new Error("체중은 0보다 커야 해요.");
  }

  return Math.round(weightKg * 30);
}
