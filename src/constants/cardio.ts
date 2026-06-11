import type {
  CardioExperience,
  CardioSessionIntensity,
  CardioType,
  PreferredCardioDurationMin,
} from "@/types/cardio";

export const CARDIO_TYPE_OPTIONS: { value: CardioType; label: string }[] = [
  { value: "walking", label: "걷기" },
  { value: "running", label: "달리기" },
  { value: "cycling", label: "자전거" },
];

export const CARDIO_TYPE_LABELS: Record<CardioType, string> = {
  walking: "걷기",
  running: "달리기",
  cycling: "자전거",
};

export const CARDIO_EXPERIENCE_OPTIONS: {
  value: CardioExperience;
  label: string;
}[] = [
  { value: "beginner", label: "처음이에요" },
  { value: "intermediate", label: "가끔 해요" },
  { value: "experienced", label: "꾸준히 해요" },
];

export const CARDIO_DURATION_OPTIONS: {
  value: PreferredCardioDurationMin;
  label: string;
}[] = [
  { value: 20, label: "20분" },
  { value: 30, label: "30분" },
  { value: 45, label: "45분" },
  { value: 60, label: "60분" },
];

export const CARDIO_DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "월" },
  { value: 1, label: "화" },
  { value: 2, label: "수" },
  { value: 3, label: "목" },
  { value: 4, label: "금" },
  { value: 5, label: "토" },
  { value: 6, label: "일" },
];

export const CARDIO_INTENSITY_SESSION_LABELS: Record<
  CardioSessionIntensity,
  string
> = {
  easy: "가볍게",
  moderate: "보통",
};
