"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";

function getInitial(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || "";
  return source ? source.charAt(0).toUpperCase() : "";
}

export function ProfileMenu() {
  const { user, signOutUser } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const photoURL = user?.photoURL ?? null;
  const initial = getInitial(user?.displayName ?? null, user?.email ?? null);

  const handleSignOut = async () => {
    setOpen(false);
    await signOutUser();
    router.replace("/login");
  };

  const goOnboarding = () => {
    setOpen(false);
    router.push("/onboarding");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="프로필 메뉴 열기"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-gakk-line bg-white text-sm font-semibold text-gakk-text-muted"
      >
        {photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoURL}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : initial ? (
          <span>{initial}</span>
        ) : (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M5 19c1.2-3 4-4.5 7-4.5s5.8 1.5 7 4.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-2xl border border-gakk-line bg-white py-1 shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            onClick={goOnboarding}
            className="block w-full px-4 py-2.5 text-left text-sm text-gakk-text hover:bg-gakk-cream"
          >
            프로필 다시 설정
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="block w-full px-4 py-2.5 text-left text-sm text-gakk-coral hover:bg-gakk-cream"
          >
            로그아웃
          </button>
        </div>
      ) : null}
    </div>
  );
}
