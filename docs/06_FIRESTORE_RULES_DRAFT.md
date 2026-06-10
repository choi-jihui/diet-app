# Firestore Rules 초안

아래는 MVP용 초안이다. 실제 배포 전 Firebase console에서 테스트해야 한다.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }

    match /users/{uid} {
      allow read, write: if isOwner(uid);

      match /{document=**} {
        allow read, write: if isOwner(uid);
      }
    }
  }
}
```

## 주의
- MVP 초안이다.
- 실제로는 필드 타입 검증, 생성/수정 시간 검증, 배열 길이 제한 등을 추가하는 것이 좋다.
- AI 생성 결과를 그대로 저장할 때도 서버에서 Zod 검증을 먼저 한다.
