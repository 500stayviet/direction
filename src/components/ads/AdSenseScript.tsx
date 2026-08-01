"use client";

import Script from "next/script";
import { getAdSenseClient, isAdSenseEnabled } from "@/lib/adsense";

/** 승인·환경변수 준비 전에는 스크립트를 로드하지 않습니다. */
export function AdSenseScript() {
  if (!isAdSenseEnabled()) return null;
  const client = getAdSenseClient();
  if (!client) return null;

  return (
    <Script
      id="adsense-script"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
