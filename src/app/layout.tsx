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
    "부동산 중개인을 위한 모바일 현장 고객·동선·매물 브리핑 앱. 원클릭 전화·네비 연동. 고객·매물·방문 일정을 계정별로 정리합니다.",
  applicationName: "현장동선",
  manifest: "/manifest.webmanifest",
  keywords: [
    "부동산",
    "중개",
    "현장동선",
    "매물",
    "고객관리",
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
        {/* 스플래시 이미지 미리 받아 로고만 뜨는 빈 구간을 줄임 */}
        <link
          rel="preload"
          href="/splash/android-1080x1920.png"
          as="image"
        />
        {/*
          홈 화면 앱 실행 스플래시.
          media 없는 항목 = 기기 매칭 실패 시 아이콘만 보이던 기본 스플래시 대신 사용.
        */}
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-1170x2532.png"
        />
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
        {/* 기본 숨김 — 탭 첫 접속일 때만 인라인 스크립트가 표시 (로그아웃 재표시 방지) */}
        <div
          id="boot-splash"
          className="boot-splash-done"
          aria-hidden="true"
          suppressHydrationWarning
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem("realty_boot_splash_done")!=="1"){var e=document.getElementById("boot-splash");if(e){e.classList.remove("boot-splash-done");e.setAttribute("aria-hidden","false");}}}catch(t){}`,
          }}
        />
        <AdSenseScript />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
