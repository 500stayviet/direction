"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function ListScrollShareTargetInner({
  idPrefix,
}: {
  idPrefix: "list-customer" | "list-property" | "list-navi";
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = searchParams.get("scrollShare");
    if (!id) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`${idPrefix}-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [searchParams, idPrefix]);

  return null;
}

/** 팀공유 알람 — scrollShare 쿼리로 리스트 카드 위치만 (해제는 카드 탭 시) */
export function ListScrollShareTarget({
  idPrefix,
}: {
  idPrefix: "list-customer" | "list-property" | "list-navi";
}) {
  return (
    <Suspense fallback={null}>
      <ListScrollShareTargetInner idPrefix={idPrefix} />
    </Suspense>
  );
}
