# Cursor 개발 프롬프트 모음

아래 프롬프트를 Cursor Composer/Agent에 순서대로 넣어라. 한 번에 전체 앱을 만들라고 하지 말고, 단계별로 진행한다.

---

## Prompt 0 — 프로젝트 이해시키기

```text
너는 내 풀스택 개발 파트너야. 이 프로젝트는 FridgeFit MVP다.

목표:
냉장고에 있는 재료로 일주일 식단과 오늘의 유산소 루틴을 짜주고, 물·수면·운동 기록까지 반영해 1주일 뒤 내 다이어트를 평가해주는 모바일 웹 MVP를 만든다.

스택:
- Next.js App Router
- TypeScript
- Tailwind CSS
- Firebase Auth + Firestore
- Gemini API는 서버 route에서만 호출
- Zod로 요청/응답 검증

반드시 지킬 것:
- 모바일 우선 UI
- AI 응답은 JSON만 사용
- 식단은 각 끼니마다 선택지 3개 제공: fat_loss, filling, lazy
- 체중 감량은 확정 표현 금지, 예상 범위로만 표현
- 1200kcal 미만 목표 칼로리 추천 금지
- 사용자를 혼내는 UX 금지

이제 현재 코드베이스를 훑고, 필요한 폴더 구조와 개발 순서를 제안해줘. 아직 코드는 수정하지 말고 계획부터 말해줘.
```

---

## Prompt 1 — 기본 프로젝트 구조 생성

```text
FridgeFit MVP의 기본 폴더 구조를 생성해줘.

필요한 구조:
- src/app 페이지: onboarding, dashboard, fridge, meal-plan, instant, cardio, log, report
- src/app/api/ai route: parse-ingredients, generate-weekly-plan, instant-meal, generate-cardio, daily-summary, weekly-report
- src/components: layout, forms, cards
- src/lib: firebase, ai, calculations, utils
- src/types

각 페이지는 일단 동작하는 placeholder UI를 만들고, 모바일 우선 Tailwind 스타일을 적용해줘.
상단에는 앱 이름 FridgeFit, 하단에는 주요 탭 네비게이션을 만들어줘.
코드 수정 후 필요한 파일 목록과 실행 방법을 알려줘.
```

---

## Prompt 2 — 타입과 계산 로직 구현

```text
FridgeFit MVP의 핵심 타입과 계산 로직을 구현해줘.

구현할 것:
1. src/types/user.ts
2. src/types/nutrition.ts
3. src/types/meal.ts
4. src/types/cardio.ts
5. src/types/log.ts
6. src/types/report.ts
7. src/lib/calculations/bmr.ts
8. src/lib/calculations/calories.ts

계산 로직:
- Mifflin-St Jeor 기반 BMR
- 활동량별 TDEE
- 다이어트 강도별 목표 칼로리
- 최소 목표 칼로리 1200kcal
- 단백질 목표: weightKg * 1.4
- 물 목표: weightKg * 33ml
- 예상 감량은 칼로리 적자 기반 범위로만 반환

모든 함수는 순수 함수로 작성하고, 입력값이 이상하면 안전한 에러를 던지게 해줘.
```

---

## Prompt 3 — 온보딩 화면 구현

```text
/onboarding 페이지를 구현해줘.

사용자가 입력할 항목:
- gender
- age
- heightCm
- weightKg
- goalWeightKg optional
- activityLevel
- dietIntensity
- cardioIntensity
- cardioDaysPerWeek
- mealsPerDay
- allergies
- dislikedFoods
- cookingTools

요구사항:
- 모바일 우선 폼
- 입력 후 BMR/TDEE/목표 칼로리/단백질 목표/물 목표 미리보기 표시
- localStorage에 profile과 targets 저장
- 추후 Firebase 저장으로 바꾸기 쉽게 함수 분리
- intensive mode 선택 시 주의 문구 표시
- 저장 후 /fridge로 이동
```

---

## Prompt 4 — 냉장고 재료 입력 화면 구현

```text
/fridge 페이지를 구현해줘.

기능:
- 사용자가 자유 텍스트로 냉장고 재료 입력
- 예시 placeholder: 계란 6개, 참치 2캔, 양배추 반 통, 닭가슴살 2팩, 사과 3개
- 일단 AI 호출 없이 간단한 콤마 split 기반 파싱 fallback 구현
- 재료 목록 카드 표시
- 재료 삭제/추가 가능
- localStorage에 ingredients 저장
- "7일 식단 만들기" 버튼을 누르면 /meal-plan으로 이동

나중에 /api/ai/parse-ingredients와 연결하기 쉽게 함수명을 분리해줘.
```

---

## Prompt 5 — Gemini 클라이언트와 Zod 스키마 준비

```text
Gemini API 호출을 위한 서버 전용 유틸과 Zod 스키마를 만들어줘.

구현할 파일:
- src/lib/ai/gemini.ts
- src/lib/ai/schemas.ts
- src/lib/ai/prompts.ts

요구사항:
- GEMINI_API_KEY는 서버에서만 읽기
- 클라이언트 컴포넌트에서 import되지 않게 주의
- generateJson 함수 생성
- Zod 스키마: IngredientParseResponse, WeeklyMealPlanResponse, InstantMealResponse, WeeklyCardioPlanResponse, DailySummaryResponse, WeeklyReportResponse
- AI 응답을 JSON.parse 후 Zod 검증
- 실패 시 명확한 에러 반환

아직 실제 route 연결은 하지 말고 유틸과 스키마만 구현해줘.
```

---

## Prompt 6 — 7일 식단 생성 API 구현

```text
/api/ai/generate-weekly-plan route를 구현해줘.

입력:
- profile
- targets
- ingredients
- preferences
- weekStartDate

출력:
WeeklyMealPlanResponse schema에 맞는 JSON.

프롬프트 요구사항:
- 7일치 식단 생성
- 각 날짜는 breakfast/lunch/dinner/snack 중 mealsPerDay에 맞게 구성
- 각 mealSlot은 반드시 3가지 옵션 포함: fat_loss, filling, lazy
- 각 option은 menuName, ingredients, shortRecipe, estimatedCalories, estimatedProteinG, cookingTimeMin, whyRecommended, swapOptions 포함
- 냉장고 재료를 우선 사용
- 사용자가 싫어하거나 알레르기 있는 음식 제외
- 칼로리 총합은 targetCalories 근처로 맞추되 너무 정확한 척하지 않기
- 한국어 UX 문장으로 응답

route는 요청 body를 Zod로 검증하고, AI 응답도 Zod로 검증해줘.
```

---

## Prompt 7 — 7일 식단 화면 연결

```text
/meal-plan 페이지를 구현해줘.

기능:
- localStorage에서 profile, targets, ingredients 읽기
- "AI로 7일 식단 생성" 버튼
- /api/ai/generate-weekly-plan 호출
- 로딩/에러/빈 상태 처리
- 7일 식단을 날짜별 카드로 표시
- 각 끼니마다 3개 옵션 표시
- 사용자가 옵션 하나를 선택하면 dailyLog의 selectedMeals에 저장
- localStorage에 weeklyMealPlan 저장

UI는 모바일에서 보기 쉽게 accordion 또는 card 형태로 만들어줘.
```

---

## Prompt 8 — 지금 뭐 먹지 즉시 추천 구현

```text
/instant 페이지와 /api/ai/instant-meal route를 구현해줘.

사용자 입력:
- mealType
- wantIngredients
- avoidIngredients
- maxCalories
- hungerLevel
- cookingTimeMin
- alreadyAteToday optional text

출력:
- 추천 옵션 3개
- todayImpact
- nextMealAdjustment

요구사항:
- 사용자가 먹고 싶은 재료를 존중하되 목표 칼로리와 단백질을 고려
- 추천 3개는 서로 달라야 함
- 먹기 싫은 재료는 제외
- 목표 초과 가능성이 있으면 혼내지 말고 다음 끼니 조정 제안
- 선택한 옵션을 오늘 dailyLog에 저장할 수 있게 하기
```

---

## Prompt 9 — 유산소 루틴 구현

```text
/cardio 페이지와 /api/ai/generate-cardio route를 구현해줘.

입력:
- profile
- targets
- cardioPreference: walking/running/cycling/treadmill/stairs/any
- cardioIntensity
- cardioDaysPerWeek
- minutesPerSession
- fitnessLevel
- sleepHours optional
- painNotes optional

출력:
- WeeklyCardioPlanResponse
- 각 session은 date, type, minutes, intensity, instructions, estimatedCaloriesBurnedRange 포함

요구사항:
- 수면이 5시간 이하이면 고강도보다 걷기/저강도 추천
- cardioIntensity가 none이면 운동 강요하지 않기
- 매일 고강도 루틴 금지
- 완료 체크 기능 만들기
- localStorage dailyLog에 cardioDone/cardioMinutes 저장
```

---

## Prompt 10 — 하루 기록과 최종 칼로리 계산 구현

```text
/log 페이지와 /api/ai/daily-summary route를 구현해줘.

/log 기능:
- 오늘 선택한 식단 옵션 표시
- 사용자가 실제 먹은 음식 텍스트로 추가 가능
- 물 섭취량 입력
- 수면 시간 입력
- 유산소 완료 여부/시간 입력
- 오늘 기분, 배고픔 1~5 입력
- 몸무게 optional 입력
- "오늘 마감하기" 버튼

/daily-summary route:
- selectedMeals, customFoods, targets, water, sleep, cardio 정보를 받아서
- totalCalories, totalProteinG, targetComparison, feedback, tomorrowAdjustment를 JSON으로 반환
- 가능하면 선택된 meal option의 estimatedCalories를 우선 합산하고, customFoods는 AI 추정으로 보완

UX:
- 초과해도 혼내지 말고 다음 끼니/내일 조정 중심으로 말하기
```

---

## Prompt 11 — 1주일 리포트 구현

```text
/report 페이지와 /api/ai/weekly-report route를 구현해줘.

입력:
- profile
- targets
- weekStartDate
- 7일 dailyLogs
- weeklyMealPlan
- weeklyCardioPlan

출력:
- averageCalories
- mealAdherenceRate
- cardioCompletionRate
- waterGoalCompletionRate
- averageSleepHours
- weightChangeKg optional
- wins
- struggles
- nextWeekStrategy
- recommendedAdjustments
- summaryText

요구사항:
- 체중이 없으면 체중 변화 평가 생략
- 실행률 중심 평가
- 다음 주 전략은 3개 이내
- 다이어트 강도 상향보다 지속 가능성을 우선 추천
- 리포트 공유용 짧은 요약 카드 문구도 생성
```

---

## Prompt 12 — Firebase Auth/Firestore 연결

```text
Firebase Auth와 Firestore 저장을 연결해줘.

구현할 것:
- src/lib/firebase/client.ts
- src/lib/firebase/firestore.ts
- 로그인/로그아웃 UI
- Google 로그인 또는 email/password 중 구현이 쉬운 방식
- 로그인 전에는 localStorage demo mode 유지
- 로그인 후에는 localStorage 데이터를 Firestore로 마이그레이션하는 버튼 제공

Firestore 구조:
users/{uid}/profile/main
users/{uid}/ingredients/{ingredientId}
users/{uid}/mealPlans/{weekStartDate}
users/{uid}/cardioPlans/{weekStartDate}
users/{uid}/dailyLogs/{date}
users/{uid}/weeklyReports/{weekStartDate}

보안:
- client에서 uid 없이 남의 데이터 접근 금지
- firestore.rules 초안도 작성해줘.
```

---

## Prompt 13 — QA와 빌드 에러 수정

```text
전체 앱을 QA해줘.

체크할 것:
- npm run lint
- npm run build
- 타입 에러
- hydration 에러 가능성
- localStorage가 server component에서 호출되는 문제
- API key가 client bundle로 새는 문제
- 각 페이지 로딩/에러/빈 상태
- 모바일 레이아웃 깨짐
- AI 응답 schema mismatch 처리

발견한 문제를 직접 수정하고, 마지막에 남은 리스크를 알려줘.
```

---

## Prompt 14 — Vercel 배포 준비

```text
Vercel 배포 준비를 해줘.

할 일:
- 필요한 환경 변수 목록 정리
- README에 배포 방법 추가
- .env.example 생성
- Firebase console에서 설정해야 할 값 목록 작성
- production에서 Gemini API key가 client에 노출되지 않는지 점검
- npm run build 통과

마지막에 배포 체크리스트를 만들어줘.
```
