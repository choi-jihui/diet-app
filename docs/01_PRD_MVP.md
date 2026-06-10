# FridgeFit MVP PRD

## 1. 제품명 후보
- FridgeFit
- 냉털핏
- Fridge Diet Coach
- What Can I Eat?
- 냉장고 다이어트 코치

## 2. 제품 정의
사용자가 보유한 냉장고 재료, 신체 정보, 다이어트 강도, 유산소 강도, 물/수면/운동 기록을 기반으로 식단과 유산소 루틴을 추천하고, 일주일 후 실행 결과를 평가하는 웹 기반 AI 다이어트 코치.

## 3. 타깃 사용자
### 1차 타깃
- 20대 여성
- 자취생
- 해외 거주자/교환학생/워홀러
- 냉장고 재료는 있는데 뭘 먹어야 할지 모르는 사람
- 운동보다 식단 결정에서 자주 무너지는 사람

### 사용자 문제
- 다이어트 앱은 많지만 대부분 먹은 뒤 기록 중심이다.
- 사용자는 먹기 전에 “지금 뭘 먹어야 덜 망하지?”가 필요하다.
- 식단 하나만 추천받으면 먹기 싫을 수 있다.
- 냉장고 재료와 현실 제약을 반영한 추천이 필요하다.
- 수면 부족, 물 부족, 운동 여부가 식욕과 실행률에 영향을 주지만 기존 식단 앱은 분리되어 있다.

## 4. 핵심 가치 제안
> 먹은 걸 기록하는 앱이 아니라, 먹기 전에 덜 망하게 도와주는 앱.

## 5. MVP 핵심 기능

### 1. 키/몸무게/나이/성별 기반 기초대사량 계산
#### 입력
- gender: female | male | other
- age
- heightCm
- weightKg
- activityLevel: sedentary | light | moderate | active

#### 계산
- BMR: Mifflin-St Jeor 공식 사용
- TDEE: BMR × 활동계수
- 목표 칼로리: 다이어트 강도에 따라 TDEE에서 차감

#### 출력
- 기초대사량
- 하루 총소모칼로리 추정치
- 추천 섭취 칼로리 범위
- 단백질 목표
- 물 목표량
- 감량 예상 범위

### 2. 다이어트 강도 설정
#### 옵션
- light: 가볍게, 하루 약 -200kcal
- standard: 보통, 하루 약 -300~-500kcal
- intensive: 강하게, 하루 약 -500~-700kcal. 단기 권장 문구 필요.

#### 정책
- 1200kcal 미만으로 추천하지 않는다.
- 사용자의 BMR보다 지나치게 낮은 섭취량이면 경고한다.
- “정확히 감량된다”가 아니라 “예상 범위”로 표현한다.

### 3. 냉장고 재료 텍스트 입력
#### 입력 방식
자유 텍스트 입력.

예시:
```text
계란 6개, 참치 2캔, 양배추 반 통, 닭가슴살 2팩, 사과 3개, 그릭요거트, 바나나 2개
```

#### 파싱 결과
- ingredientName
- quantityText
- category: protein | carb | vegetable | fruit | dairy | fat | snack | drink | unknown
- priority: normal | useSoon

### 4. 일주일 식단 생성
#### 입력
- 사용자 신체 정보
- 목표 칼로리
- 식사 수
- 냉장고 재료
- 못 먹는 음식
- 다이어트 강도
- 조리 도구

#### 출력
7일 식단표. 각 날짜는 breakfast/lunch/dinner/snack 구조.

각 끼니에는 다음 포함:
- menuName
- ingredients
- shortRecipe
- estimatedCalories
- estimatedProteinG
- whyRecommended
- swapOptions

### 5. 끼니별 선택지 3개 제공
각 끼니마다 선택지 3개를 준다.

- optionA: 가장 감량형
- optionB: 든든한 버전
- optionC: 귀찮은 날 버전

각 옵션에 칼로리, 단백질, 조리시간, 장점, 주의점 포함.

### 6. 오늘 먹고 싶은 재료 기반 즉시 추천
#### 기능명
지금 뭐 먹지?

#### 입력
- mealType: breakfast | lunch | dinner | snack
- wantIngredients
- avoidIngredients
- maxCalories
- hungerLevel: 1~5
- cookingTimeMin
- alreadyAteToday

#### 출력
- 추천 3개
- 오늘 목표 대비 영향
- 단백질 부족/과잉 여부
- 다음 끼니 조정 제안

### 7. 하루 최종 칼로리 계산
#### 입력
- 실제 먹은 음식 목록
- AI 추천 식단 중 선택한 옵션
- 사용자가 직접 수정한 음식
- 간식/음료

#### 출력
- 총 섭취 칼로리
- 목표 대비 차이
- 단백질 추정량
- 물/수면/운동 반영 피드백
- 내일 조정 제안

### 8. 유산소 루틴 생성
#### 입력
- cardioPreference: walking | running | cycling | treadmill | stairs | any
- cardioIntensity: none | low | medium | high
- daysPerWeek
- minutesPerSession
- fitnessLevel: beginner | normal | trained
- sleepHours
- painNotes

#### 출력
- 주간 유산소 루틴
- 오늘의 유산소
- 컨디션 기반 조정
- 예상 소모 칼로리 범위

### 9. 물/수면/운동 체크
#### 매일 기록
- waterMl
- sleepHours
- cardioDone: boolean
- cardioMinutes
- mealAdherencePercent
- mood: 1~5
- hunger: 1~5
- optionalWeightKg

### 10. 1주일 리포트
#### 출력
- 평균 섭취 칼로리
- 식단 실행률
- 유산소 완료율
- 물 목표 달성률
- 평균 수면
- 몸무게 변화, 입력한 경우만
- 가장 잘한 점
- 가장 어려웠던 점
- 다음 주 전략
- 다음 주 다이어트 강도 조정 제안

## 6. 1번부터 12번까지 상세 기능 정리

### 1) 온보딩
사용자 기본 정보와 목표를 받는다.

### 2) 기초대사량 계산
Mifflin-St Jeor 공식으로 계산한다.

### 3) 목표 칼로리 계산
다이어트 강도와 활동량을 반영한다.

### 4) 냉장고 재료 입력
자연어 텍스트를 입력받고 AI/로직으로 재료 목록으로 변환한다.

### 5) 7일 식단 생성
냉장고 재료 중심으로 일주일 식단을 생성한다.

### 6) 끼니별 선택지 3개
각 끼니마다 감량형/든든형/귀찮은날 버전 제공.

### 7) 즉시 추천
오늘 먹고 싶은 재료와 싫은 재료를 반영해 즉시 메뉴 추천.

### 8) 하루 마감 리포트
총 섭취 칼로리, 목표 대비, 단백질, 물, 수면, 운동 피드백.

### 9) 유산소 루틴
걷기/뛰기/자전거 기반 주간 루틴 생성.

### 10) 강도 설정
다이어트 강도와 유산소 강도를 사용자가 조절.

### 11) 변화 시뮬레이션
칼로리 적자 기반 예상 감량 범위와 목표까지 예상 기간 표시.

### 12) 주간 종합 평가
7일 기록을 바탕으로 다음 주 계획을 자동 조정.

## 7. 금지/주의 UX
- “실패”라는 표현 금지
- “정확히 3kg 감량” 같은 확정 표현 금지
- 섭식장애를 유발할 수 있는 과도한 제한 문구 금지
- 의료 진단/처방 금지
- 미성년자 대상 체중감량 강조 금지

## 8. 좋은 피드백 톤
- “오늘 목표보다 120kcal 높지만 큰 문제는 아니에요.”
- “내일 첫 끼에 단백질을 조금 보완하면 좋아요.”
- “수면이 부족해서 강한 유산소보다 걷기를 추천해요.”
- “이번 주는 칼로리보다 실행률이 더 중요해요.”
