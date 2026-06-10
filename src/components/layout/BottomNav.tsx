"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_NAV_ITEMS } from "@/constants/navigation";
import { NavIcon } from "@/components/icons/NavIcon";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-gakk-sage/40 bg-white/95 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md"
      aria-label="주요 메뉴"
    >
      <ul className="flex items-stretch justify-between">
        {MAIN_NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-medium transition-colors ${
                  isActive
                    ? "bg-gakk-mint/15 text-gakk-mint"
                    : "text-gakk-text-muted hover:text-gakk-text"
                }`}
              >
                <NavIcon name={item.icon} className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
