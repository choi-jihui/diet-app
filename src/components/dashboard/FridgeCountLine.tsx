"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/useAuth";
import { listIngredients } from "@/lib/firebase/ingredient-repo";

export function FridgeCountLine() {
  const { user } = useAuth();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      return;
    }

    let active = true;
    listIngredients(uid)
      .then((items) => {
        if (active) {
          setCount(items.length);
        }
      })
      .catch(() => {
        // 보조 정보이므로 실패해도 조용히 무시한다.
      });

    return () => {
      active = false;
    };
  }, [user?.uid]);

  if (count === null) {
    return null;
  }

  return (
    <Link
      href="/diet?tab=fridge"
      className="flex items-center justify-between px-1 text-sm text-gakk-text-muted"
    >
      <span>냉장고 재료 {count}개</span>
      <span className="text-gakk-mint">→</span>
    </Link>
  );
}
