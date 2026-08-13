import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: {
    default: "관리자",
    template: "%s · 현장동선 관리자",
  },
  description: "현장동선 운영·관리자 전용",
  applicationName: "현장동선 관리자",
  manifest: "/manifest-admin.webmanifest",
  icons: {
    icon: [
      { url: "/admin-icon.svg", type: "image/svg+xml" },
      { url: "/admin-favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/admin-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/admin-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/admin-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "동선관리자",
    statusBarStyle: "black-translucent",
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
  themeColor: "#1B2A4A",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
