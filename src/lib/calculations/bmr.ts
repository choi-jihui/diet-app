import type { Gender } from "@/types/user";

export interface BmrInput {
  gender: Gender;
  weightKg: number;
  heightCm: number;
  age: number;
}

export function calculateBmr(input: BmrInput): number {
  const { gender, weightKg, heightCm, age } = input;

  if (weightKg <= 0 || heightCm <= 0 || age <= 0) {
    throw new Error("체중, 키, 나이는 0보다 커야 해요.");
  }

  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;

  if (gender === "male") {
    return Math.round(base + 5);
  }

  if (gender === "female") {
    return Math.round(base - 161);
  }

  return Math.round(base - 78);
}
