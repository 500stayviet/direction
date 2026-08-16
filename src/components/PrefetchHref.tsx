"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 스와이프 카드처럼 Link로 감쌀 수 없을 때, 상세 경로만 미리 받는다 */
export function PrefetchHref({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);
  return null;
}
