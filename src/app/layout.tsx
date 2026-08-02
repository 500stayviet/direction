import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { AdSenseScript } from "@/components/ads/AdSenseScript";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "현장동선",
    template: "%s · 현장동선",
  },
  description:
    "부동산 중개인을 위한 모바일 현장 고객·동선·매물 브리핑 앱. 원클릭 전화·네비 연동. 손님·매물·방문 일정을 계정별로 정리합니다.",
  applicationName: "현장동선",
  manifest: "/manifest.webmanifest",
  keywords: [
    "부동산",
    "중개",
    "현장동선",
    "매물",
    "손님관리",
    "임장",
    "네비",
  ],
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "현장동선",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#F9FAFB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* 홈 화면 앱 실행 시 네이티브 스플래시(로고+현장동선+제공 - 미스터k) */}
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-1290x2796.png"
          media="screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-1179x2556.png"
          media="screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-1284x2778.png"
          media="screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-1170x2532.png"
          media="screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-1125x2436.png"
          media="screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-1242x2208.png"
          media="screen and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-828x1792.png"
          media="screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-750x1334.png"
          media="screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
      </head>
      <body className="antialiased">
        {/* 앱 첫 로딩용 — React가 관리. AuthGate는 숨기기만 하고 DOM에서 제거하지 않음 */}
        <div id="boot-splash" aria-hidden="true">
          <div className="boot-splash-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon-192.png"
              alt=""
              width={128}
              height={128}
              className="boot-splash-icon"
            />
            <p className="boot-splash-title">현장동선</p>
          </div>
          <p className="boot-splash-credit">제공 - 미스터k</p>
        </div>
        <AdSenseScript />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
