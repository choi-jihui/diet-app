export interface FeatureMeta {
  id: number;
  title: string;
  description: string;
  href: string;
  phase: number;
}

export const MVP_FEATURES: FeatureMeta[] = [
  {
    id: 1,
    title: "기초대사량 계산",
    description: "키, 몸무게, 나이, 성별을 바탕으로 시작점을 잡아요.",
    href: "/onboarding",
    phase: 2,
  },
  {
    id: 2,
    title: "다이어트 강도 설정",
    description: "나에게 맞는 페이스로 목표를 설정해요.",
    href: "/onboarding",
    phase: 2,
  },
  {
    id: 3,
    title: "냉장고 재료 입력",
    description: "있는 재료를 텍스트로 적어주세요.",
    href: "/fridge",
    phase: 6,
  },
  {
    id: 4,
    title: "일주일 식단 생성",
    description: "냉장고 재료 중심으로 7일 식단을 만들어요.",
    href: "/meal-plan",
    phase: 6,
  },
  {
    id: 5,
    title: "끼니별 선택지 3개",
    description: "감량형 · 든든형 · 간편형 중 골라요.",
    href: "/meal-plan",
    phase: 6,
  },
  {
    id: 6,
    title: "즉시 추천",
    description: "지금 먹고 싶은 재료로 바로 추천받아요.",
    href: "/instant",
    phase: 6,
  },
  {
    id: 7,
    title: "하루 칼로리 정리",
    description: "오늘 먹은 것을 부드럽게 돌아봐요.",
    href: "/log",
    phase: 6,
  },
  {
    id: 8,
    title: "유산소 루틴",
    description: "오늘 컨디션에 맞는 유산소를 추천해요.",
    href: "/cardio",
    phase: 6,
  },
  {
    id: 9,
    title: "물 · 수면 · 운동 체크",
    description: "작은 기록이 쌓이면 더 편해져요.",
    href: "/log",
    phase: 6,
  },
  {
    id: 10,
    title: "1주일 리포트",
    description: "일주일 뒤, 실행을 함께 돌아봐요.",
    href: "/report",
    phase: 7,
  },
];
