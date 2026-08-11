"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAdSenseEnabled } from "@/lib/adsense";

const STORAGE_KEY = "realty_ad_consent_v1";

/**
 * 광고가 켜진 경우에만 표시하는 안내 배너.
 * 승인 전(ENABLED=false)에는 나타나지 않습니다.
 */
export function AdConsentNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isAdSenseEnabled()) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3"
      style={{ paddingBottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto w-full max-w-[406px] rounded-2xl border border-gray-200 bg-white/95 p-3.5 shadow-[0_12px_40px_rgba(15,23,42,0.16)] backdrop-blur">
        <p className="text-[12px] leading-relaxed text-gray-600">
          서비스 운영을 위해 Google AdSense 등 제3자 광고가 표시될 수 있으며,
          광고·측정용 쿠키가 사용될 수 있습니다. 네비(현장) 화면에는 광고를 두지
          않는 것을 원칙으로 합니다.{" "}
          <Link
            href="/terms"
            className="font-bold text-[#3182F6] underline-offset-2 hover:underline"
          >
            약관·개인정보·광고
          </Link>
          를 확인해 주세요.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-2.5 w-full rounded-xl bg-[#3182F6] py-2.5 text-[13px] font-bold text-white active:scale-[0.99] transition-all duration-150"
        >
          확인
        </button>
      </div>
    </div>
  );
}
