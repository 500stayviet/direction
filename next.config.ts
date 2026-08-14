import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js는 워커/Node 경로가 있어 SSR 번들에 넣으면
  // 컴파일마다 Module not found가 나고 Fast Refresh가 반복된다.
  serverExternalPackages: ["tesseract.js"],
};

export default nextConfig;
