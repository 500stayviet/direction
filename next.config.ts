import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js는 워커/Node 경로가 있어 SSR 번들에 넣으면
  // 컴파일마다 Module not found가 나고 Fast Refresh가 반복된다.
  serverExternalPackages: ["tesseract.js"],
  async headers() {
    const noStore = [
      {
        key: "Cache-Control",
        value: "public, max-age=0, must-revalidate",
      },
    ];
    return [
      { source: "/splash/:file*", headers: noStore },
      { source: "/icon-192.png", headers: noStore },
      { source: "/icon-512.png", headers: noStore },
      { source: "/icon-1024.png", headers: noStore },
      { source: "/favicon.png", headers: noStore },
      { source: "/icon.svg", headers: noStore },
    ];
  },
};

export default nextConfig;
