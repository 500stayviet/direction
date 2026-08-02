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
      </head>
      <body className="antialiased">
        <AdSenseScript />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
