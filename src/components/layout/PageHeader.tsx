import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@/constants/app";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBrand?: boolean;
  backHref?: string;
  action?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  showBrand = false,
  backHref,
  action,
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-gakk-line bg-gakk-cream/95 px-5 pb-4 pt-6 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        {backHref ? (
          <Link
            href={backHref}
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-gakk-text-muted shadow-sm"
            aria-label="뒤로 가기"
          >
            ←
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          {showBrand ? (
            <p className="mb-1 text-xs font-semibold tracking-wide text-gakk-mint">{APP_NAME}</p>
          ) : null}
          <h1 className="text-xl font-bold text-gakk-text">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm leading-relaxed text-gakk-text-muted">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
