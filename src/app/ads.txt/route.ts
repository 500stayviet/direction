import { getAdSensePublisherId } from "@/lib/adsense";

/**
 * https://your-domain/ads.txt
 * 승인 후 NEXT_PUBLIC_ADSENSE_PUB_ID 또는 CLIENT 설정 시 자동 출력
 */
export function GET() {
  const pubId = getAdSensePublisherId();

  if (!pubId) {
    const body = [
      "# 현장동선 ads.txt",
      "# AdSense 승인 후 .env 에 NEXT_PUBLIC_ADSENSE_CLIENT(ca-pub-...) 또는",
      "# NEXT_PUBLIC_ADSENSE_PUB_ID(pub-...) 를 설정하면 이 파일이 채워집니다.",
      "",
    ].join("\n");

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  const body = `google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
