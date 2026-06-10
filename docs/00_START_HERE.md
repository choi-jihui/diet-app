# FridgeFit MVP — Cursor 개발 시작 문서

## 한 줄 정의
냉장고에 있는 재료로 일주일 식단과 오늘의 유산소 루틴을 짜주고, 물·수면·운동 기록까지 반영해 1주일 뒤 내 다이어트를 평가해주는 AI 웹 코치.

## 개발 목표
초기 버전은 모바일 웹 우선으로 만든다. 앱이 아니라 웹 MVP다. 사용자가 아래 흐름을 실제로 완료할 수 있으면 1차 성공이다.

1. 키/몸무게/나이/성별 입력
2. 기초대사량과 목표 칼로리 확인
3. 다이어트 강도와 유산소 강도 설정
4. 냉장고 재료 입력
5. 일주일 식단 생성
6. 끼니별 선택지 3개 확인
7. 오늘 먹고 싶은 재료로 즉시 추천 받기
8. 하루 최종 칼로리 계산
9. 유산소 루틴 받기
10. 물/수면/운동 체크
11. 1주일 리포트 확인

## 추천 스택
- Framework: Next.js App Router + TypeScript
- Styling: Tailwind CSS
- UI: shadcn/ui 또는 직접 Tailwind 컴포넌트
- Auth: Firebase Auth, MVP에서는 Google login 또는 email/password
- DB: Firebase Firestore
- AI: Gemini API 또는 OpenAI API. 이 문서는 Gemini API 기준으로 작성한다.
- Deploy: Vercel

## 중요한 개발 원칙
- 처음부터 앱처럼 크게 만들지 않는다.
- 음식 사진 인식, 바코드, HealthKit 연동은 2차 버전으로 미룬다.
- MVP는 텍스트 입력과 AI JSON 응답만으로 만든다.
- AI 응답은 반드시 JSON Schema로 고정한다.
- 사용자에게 의료적 진단/치료처럼 말하지 않는다.
- 체중 감량은 “예상 범위”로만 표현한다.
- 실패/초과를 혼내지 않는다. 다음 끼니 조정 중심으로 피드백한다.

## 레포 생성 후 첫 작업
```bash
npx create-next-app@latest fridgefit-mvp --typescript --tailwind --eslint --app --src-dir
cd fridgefit-mvp
npm install firebase zod date-fns lucide-react
npm install @google/genai
```

선택:
```bash
npx shadcn@latest init
npx shadcn@latest add button card input textarea select tabs progress badge checkbox
```

## Cursor 사용 방식
1. 이 폴더의 문서를 프로젝트 루트에 복사한다.
2. `.cursor/rules/fridgefit.mdc`를 실제 프로젝트의 `.cursor/rules/fridgefit.mdc`에 넣는다.
3. Cursor Composer/Agent에 `04_CURSOR_BUILD_PROMPTS.md`의 프롬프트를 1단계부터 순서대로 넣는다.
4. 한 번에 전체 앱을 만들라고 하지 말고, 기능별로 만들고 매번 `npm run lint`, `npm run build`를 통과시킨다.

## MVP 완료 기준
- 로그인 없이도 데모 사용 가능하거나, 로그인 후 사용자별 저장 가능
- 온보딩 완료 가능
- BMR/TDEE/목표 칼로리 계산 가능
- 냉장고 재료 입력 가능
- AI가 7일 식단 JSON 생성
- AI가 끼니별 선택지 3개 생성
- 즉시 추천 생성 가능
- 하루 기록 저장 가능
- 주간 리포트 생성 가능
- Vercel 배포 가능
