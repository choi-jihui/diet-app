"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FullScreenError, FullScreenLoading } from "@/components/auth/AuthStates";
import { useAuth } from "@/lib/auth/useAuth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, authLoading, profileStatus, retryProfileSync } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    if (profileStatus === "needs-onboarding") {
      router.replace("/onboarding");
    }
  }, [authLoading, user, profileStatus, router]);

  if (authLoading || !user) {
    return <FullScreenLoading />;
  }

  if (profileStatus === "idle" || profileStatus === "loading") {
    return <FullScreenLoading message="프로필을 확인하는 중..." />;
  }

  if (profileStatus === "needs-onboarding") {
    return <FullScreenLoading message="온보딩으로 이동 중..." />;
  }

  if (profileStatus === "error") {
    return (
      <FullScreenError
        message="프로필을 불러오지 못했어요. 다시 시도해 주세요."
        onRetry={retryProfileSync}
      />
    );
  }

  return <>{children}</>;
}
