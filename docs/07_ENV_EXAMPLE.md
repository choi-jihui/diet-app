# .env.example

프로젝트 루트에 `.env.local`을 만들고 아래 값을 채운다.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

GEMINI_API_KEY=
```

## 보안 원칙
- `GEMINI_API_KEY`는 서버에서만 사용한다.
- `GEMINI_API_KEY` 앞에 `NEXT_PUBLIC_`를 붙이면 안 된다.
- Vercel Project Settings > Environment Variables에 같은 값을 등록한다.
- 환경변수 변경 후에는 새 배포가 필요하다.
