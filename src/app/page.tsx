import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@/constants/app";
import { SUPPORTIVE_COPY } from "@/constants/copy";

export default function LandingPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-gakk-cream px-6 pb-10 pt-16">
      <div className="flex-1">
        <p className="inline-flex rounded-full bg-white/80 px-4 py-1.5 text-xs font-semibold text-gakk-mint shadow-sm">
          웰니스 · 식단 · 유산소
        </p>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-gakk-text">{APP_NAME}</h1>
        <p className="mt-3 text-lg leading-relaxed text-gakk-text-muted">{APP_TAGLINE}</p>
        <p className="mt-6 rounded-3xl bg-white/70 p-5 text-sm leading-relaxed text-gakk-text-muted shadow-sm">
          {SUPPORTIVE_COPY.gentleStart}
        </p>

        <ul className="mt-8 space-y-3 text-sm text-gakk-text-muted">
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-gakk-mint" />
            냉장고 재료로 일주일 식단
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-gakk-lime" />
            끼니마다 3가지 선택지
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-gakk-sage" />
            물 · 수면 · 운동까지 함께
          </li>
        </ul>
      </div>

      <div className="mt-10 space-y-3">
        <Link
          href="/onboarding"
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-gakk-mint text-base font-semibold text-white shadow-md transition-transform active:scale-[0.98]"
        >
          시작하기
        </Link>
        <Link
          href="/dashboard"
          className="flex h-14 w-full items-center justify-center rounded-2xl border border-gakk-sage/60 bg-white text-base font-semibold text-gakk-text transition-transform active:scale-[0.98]"
        >
          둘러보기
        </Link>
      </div>
    </div>
  );
}
