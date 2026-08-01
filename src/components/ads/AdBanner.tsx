"use client";

import { useEffect, useRef } from "react";
import {
  getAdSenseClient,
  getAdSlot,
  isAdSenseEnabled,
} from "@/lib/adsense";

type AdBannerProps = {
  slot: "home" | "about";
  className?: string;
};

/**
 * 광고 슬롯. 승인 전이거나 슬롯 ID가 없으면 아무것도 렌더하지 않습니다.
 * 현장 리드(/navi/[id])에는 사용하지 마세요.
 */
export function AdBanner({ slot, className = "" }: AdBannerProps) {
  const pushed = useRef(false);
  const enabled = isAdSenseEnabled();
  const client = getAdSenseClient();
  const adSlot = getAdSlot(slot);

  useEffect(() => {
    if (!enabled || !client || !adSlot || pushed.current) return;
    try {
      const w = window as Window & { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
      pushed.current = true;
    } catch {
      /* AdSense 미로드·차단 시 무시 */
    }
  }, [enabled, client, adSlot]);

  if (!enabled || !client || !adSlot) return null;

  return (
    <div
      className={[
        "overflow-hidden rounded-2xl border border-gray-100 bg-white",
        className,
      ].join(" ")}
      aria-label="광고"
    >
      <p className="px-3 pt-2 text-[10px] font-semibold tracking-wide text-gray-400">
        광고
      </p>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
