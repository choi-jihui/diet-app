"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FullScreenLoading } from "@/components/auth/AuthStates";
import { APP_NAME, APP_TAGLINE } from "@/constants/app";
import { useAuth } from "@/lib/auth/useAuth";
import { isFirebaseConfigured } from "@/lib/firebase/client";

export function LoginContent() {
  const {
    user,
    authLoading,
    signingIn,
    error,
    profileStatus,
    signInWithGoogle,
  } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    if (profileStatus === "ready") {
      router.replace("/dashboard");
    } else if (profileStatus === "needs-onboarding") {
      router.replace("/onboarding");
    }
  }, [authLoading, user, profileStatus, router]);

  if (authLoading) {
    return <FullScreenLoading />;
  }

  if (user && (profileStatus === "ready" || profileStatus === "needs-onboarding")) {
    return <FullScreenLoading message="이동 중..." />;
  }

  if (user && (profileStatus === "idle" || profileStatus === "loading")) {
    return <FullScreenLoading message="프로필을 확인하는 중..." />;
  }

  const configured = isFirebaseConfigured();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 pb-16">
      <p className="text-xs font-semibold tracking-wide text-gakk-mint">{APP_NAME}</p>
      <h1 className="mt-2 text-2xl font-bold text-gakk-text">로그인</h1>
      <p className="mt-2 text-sm leading-relaxed text-gakk-text-muted">{APP_TAGLINE}</p>

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={signingIn || !configured}
        className="mt-8 flex h-12 w-full items-center justify-center rounded-2xl border border-gakk-line bg-white text-sm font-semibold text-gakk-text disabled:opacity-60"
      >
        {signingIn ? "로그인 중..." : "Google로 계속하기"}
      </button>

      {!configured ? (
        <p className="mt-3 text-xs leading-relaxed text-gakk-text-muted">
          Firebase 환경변수가 아직 설정되지 않았어요. .env.local에 값을 입력한 뒤 다시
          시도해 주세요.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-gakk-coral">{error}</p>
      ) : null}
    </div>
  );
}
