import type {
  ActivityLevel,
  CardioIntensity,
  DietIntensity,
  Gender,
} from "@/types/user";

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "female", label: "여성" },
  { value: "male", label: "남성" },
  { value: "other", label: "기타" },
];

export const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: "sedentary", label: "거의 안 움직임" },
  { value: "light", label: "가벼운 활동" },
  { value: "moderate", label: "보통" },
  { value: "active", label: "활동적" },
];

export const DIET_INTENSITY_OPTIONS: { value: DietIntensity; label: string }[] = [
  { value: "light", label: "가볍게" },
  { value: "normal", label: "보통" },
  { value: "intensive", label: "강하게" },
];

export const CARDIO_INTENSITY_OPTIONS: { value: CardioIntensity; label: string }[] = [
  { value: "none", label: "안 함" },
  { value: "two_days", label: "주 2회" },
  { value: "three_days", label: "주 3회" },
  { value: "five_days", label: "주 5회" },
];

export function getGenderLabel(value: Gender): string {
  return GENDER_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getActivityLabel(value: ActivityLevel): string {
  return ACTIVITY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getDietIntensityLabel(value: DietIntensity): string {
  return DIET_INTENSITY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getCardioIntensityLabel(value: CardioIntensity): string {
  return CARDIO_INTENSITY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
