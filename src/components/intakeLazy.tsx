"use client";

import dynamic from "next/dynamic";

/** 등록 화면 첫 페인트에서 대화·메시지 모달을 빼기 위한 지연 로드 */
export const IntakeTalkModal = dynamic(
  () =>
    import("@/components/IntakeTalkModal").then((m) => m.IntakeTalkModal),
  { ssr: false }
);

export const IntakeMessageModal = dynamic(
  () =>
    import("@/components/IntakeMessageModal").then((m) => m.IntakeMessageModal),
  { ssr: false }
);
