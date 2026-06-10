# FridgeFit 기술 설계서 — Next.js + Firebase + Gemini

## 1. 아키텍처

```text
User Browser
  ↓
Next.js App Router
  ├─ Client Components: UI, forms, dashboard
  ├─ Server Actions / API Routes: AI call, secure calculations
  ↓
Firebase
  ├─ Auth
  └─ Firestore
  ↓
Gemini API
  └─ Structured JSON meal/cardio/report generation
```

## 2. 환경 변수

`.env.local`

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

GEMINI_API_KEY=
```

주의:
- `NEXT_PUBLIC_` 값은 브라우저에 노출될 수 있다.
- `GEMINI_API_KEY`는 절대 `NEXT_PUBLIC_`를 붙이지 않는다.
- AI 호출은 서버 라우트에서만 한다.

## 3. 폴더 구조

```text
src/
  app/
    page.tsx
    onboarding/page.tsx
    dashboard/page.tsx
    fridge/page.tsx
    meal-plan/page.tsx
    instant/page.tsx
    cardio/page.tsx
    log/page.tsx
    report/page.tsx
    api/
      ai/
        parse-ingredients/route.ts
        generate-weekly-plan/route.ts
        instant-meal/route.ts
        generate-cardio/route.ts
        daily-summary/route.ts
        weekly-report/route.ts
  components/
    layout/
    forms/
    cards/
    charts/
  lib/
    firebase/client.ts
    firebase/firestore.ts
    ai/gemini.ts
    ai/schemas.ts
    calculations/bmr.ts
    calculations/calories.ts
    utils/date.ts
  types/
    user.ts
    nutrition.ts
    meal.ts
    cardio.ts
    log.ts
    report.ts
```

## 4. 타입 설계

### UserProfile
```ts
export type Gender = 'female' | 'male' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';
export type DietIntensity = 'light' | 'standard' | 'intensive';
export type CardioIntensity = 'none' | 'low' | 'medium' | 'high';

export interface UserProfile {
  uid: string;
  displayName?: string;
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  goalWeightKg?: number;
  activityLevel: ActivityLevel;
  dietIntensity: DietIntensity;
  cardioIntensity: CardioIntensity;
  cardioDaysPerWeek: number;
  mealsPerDay: 2 | 3;
  allergies: string[];
  dislikedFoods: string[];
  cookingTools: string[];
  createdAt: string;
  updatedAt: string;
}
```

### NutritionTargets
```ts
export interface NutritionTargets {
  bmr: number;
  tdee: number;
  targetCalories: number;
  calorieDeficit: number;
  proteinGoalG: number;
  waterGoalMl: number;
  expectedWeeklyLossKgRange: [number, number];
}
```

### Ingredient
```ts
export type IngredientCategory =
  | 'protein'
  | 'carb'
  | 'vegetable'
  | 'fruit'
  | 'dairy'
  | 'fat'
  | 'snack'
  | 'drink'
  | 'unknown';

export interface Ingredient {
  id: string;
  userId: string;
  name: string;
  quantityText?: string;
  category: IngredientCategory;
  useSoon?: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### MealOption
```ts
export interface MealOption {
  label: 'fat_loss' | 'filling' | 'lazy';
  menuName: string;
  ingredients: string[];
  shortRecipe: string;
  estimatedCalories: number;
  estimatedProteinG: number;
  cookingTimeMin: number;
  whyRecommended: string;
  swapOptions: string[];
  caution?: string;
}
```

### DailyMealPlan
```ts
export interface MealSlot {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  options: MealOption[];
}

export interface DailyMealPlan {
  date: string;
  dayLabel: string;
  targetCalories: number;
  mealSlots: MealSlot[];
  dailyNote: string;
}

export interface WeeklyMealPlan {
  id: string;
  userId: string;
  weekStartDate: string;
  fridgeIngredientSnapshot: Ingredient[];
  days: DailyMealPlan[];
  createdAt: string;
}
```

### CardioPlan
```ts
export interface CardioSession {
  date: string;
  type: 'walking' | 'running' | 'cycling' | 'treadmill' | 'stairs' | 'rest';
  minutes: number;
  intensity: 'low' | 'medium' | 'high';
  instructions: string;
  estimatedCaloriesBurnedRange: [number, number];
}

export interface WeeklyCardioPlan {
  id: string;
  userId: string;
  weekStartDate: string;
  sessions: CardioSession[];
  note: string;
}
```

### DailyLog
```ts
export interface DailyLog {
  id: string;
  userId: string;
  date: string;
  selectedMeals: {
    breakfast?: MealOption;
    lunch?: MealOption;
    dinner?: MealOption;
    snack?: MealOption;
  };
  customFoods: string[];
  totalCalories?: number;
  totalProteinG?: number;
  waterMl: number;
  sleepHours?: number;
  cardioDone: boolean;
  cardioMinutes?: number;
  mealAdherencePercent?: number;
  mood?: number;
  hunger?: number;
  weightKg?: number;
  createdAt: string;
  updatedAt: string;
}
```

### WeeklyReport
```ts
export interface WeeklyReport {
  id: string;
  userId: string;
  weekStartDate: string;
  averageCalories: number;
  mealAdherenceRate: number;
  cardioCompletionRate: number;
  waterGoalCompletionRate: number;
  averageSleepHours?: number;
  weightChangeKg?: number;
  wins: string[];
  struggles: string[];
  nextWeekStrategy: string[];
  recommendedAdjustments: {
    dietIntensity?: DietIntensity;
    cardioIntensity?: CardioIntensity;
    targetCalories?: number;
  };
  summaryText: string;
  createdAt: string;
}
```

## 5. Firestore 데이터 구조

Firestore는 컬렉션/문서 구조를 사용한다. 사용자별 데이터 접근이 쉬운 구조로 간다.

```text
users/{uid}
  profile/main
  ingredients/{ingredientId}
  mealPlans/{weekStartDate}
  cardioPlans/{weekStartDate}
  dailyLogs/{date}
  weeklyReports/{weekStartDate}
```

대안:
```text
users/{uid}
mealPlans/{planId}
dailyLogs/{logId}
```

MVP에서는 사용자별 하위 컬렉션이 더 직관적이다.

## 6. 계산 로직

### BMR — Mifflin-St Jeor
```ts
export function calculateBmr(params: {
  gender: 'female' | 'male' | 'other';
  weightKg: number;
  heightCm: number;
  age: number;
}) {
  const base = 10 * params.weightKg + 6.25 * params.heightCm - 5 * params.age;
  if (params.gender === 'male') return Math.round(base + 5);
  if (params.gender === 'female') return Math.round(base - 161);
  return Math.round(base - 78); // simple midpoint for MVP; explain as estimate
}
```

### Activity multiplier
```ts
const activityMultipliers = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};
```

### Diet intensity deficit
```ts
const intensityDeficit = {
  light: 200,
  standard: 400,
  intensive: 600,
};

const MIN_TARGET_CALORIES = 1200;
```

### Protein goal
MVP에서는 `weightKg * 1.2~1.6g` 범위로 안내한다.

```ts
proteinGoalG = Math.round(weightKg * 1.4)
```

### Water goal
MVP에서는 `weightKg * 30~35ml` 범위로 안내한다.

```ts
waterGoalMl = Math.round(weightKg * 33)
```

## 7. API Routes

### POST /api/ai/parse-ingredients
입력:
```json
{ "text": "계란 6개, 참치 2캔, 양배추 반 통" }
```

출력:
```json
{
  "ingredients": [
    { "name": "계란", "quantityText": "6개", "category": "protein", "useSoon": false }
  ]
}
```

### POST /api/ai/generate-weekly-plan
입력:
```json
{
  "profile": {},
  "targets": {},
  "ingredients": [],
  "preferences": {}
}
```

출력: `WeeklyMealPlan`

### POST /api/ai/instant-meal
입력:
```json
{
  "mealType": "dinner",
  "wantIngredients": ["참치", "바나나"],
  "avoidIngredients": ["양배추"],
  "maxCalories": 500,
  "todayLog": {}
}
```

출력:
```json
{
  "options": [],
  "todayImpact": "",
  "nextMealAdjustment": ""
}
```

### POST /api/ai/generate-cardio
출력: `WeeklyCardioPlan`

### POST /api/ai/daily-summary
출력:
```json
{
  "totalCalories": 1480,
  "totalProteinG": 82,
  "targetComparison": "목표보다 +80kcal",
  "feedback": "",
  "tomorrowAdjustment": []
}
```

### POST /api/ai/weekly-report
출력: `WeeklyReport`

## 8. Gemini Structured Output 원칙
- AI 응답은 자유 텍스트가 아니라 JSON으로 받는다.
- Zod schema를 만든 뒤 JSON Schema로 변환하거나, API의 schema 기능을 활용한다.
- 서버에서 응답을 검증한다.
- 검증 실패 시 재요청하거나 안전한 fallback을 보여준다.

## 9. 페이지별 기능

### `/`
랜딩 페이지.
- 한 줄 소개
- “냉장고 재료로 식단 만들기” CTA
- 데모 예시

### `/onboarding`
- 신체 정보 입력
- 목표/강도 설정
- 조리 환경 입력

### `/dashboard`
- 오늘 목표 칼로리
- 오늘 식단
- 오늘 유산소
- 물/수면/운동 체크

### `/fridge`
- 재료 텍스트 입력
- 재료 목록 관리

### `/meal-plan`
- 7일 식단표
- 끼니별 선택지 3개
- 선택한 메뉴 저장

### `/instant`
- 지금 뭐 먹지?
- 먹고 싶은 재료/싫은 재료 입력
- 즉시 추천

### `/cardio`
- 주간 유산소 루틴
- 오늘 운동 완료 체크

### `/log`
- 하루 기록
- 최종 칼로리 계산

### `/report`
- 주간 리포트

## 10. 보안/정책
- Gemini API key는 서버에서만 사용.
- Firestore security rules에서 `request.auth.uid == uid`만 허용.
- 데모 모드는 localStorage 저장 가능.
- 로그인 사용자만 Firestore 저장.

## 11. MVP에서는 하지 말 것
- 음식 사진 칼로리 추정
- 냉장고 사진 인식
- 바코드 스캔
- 결제
- 커뮤니티
- Apple Health/Google Fit 연동
- 복잡한 그래프
