/**
 * AdSense는 승인 + 환경변수 설정 후에만 동작합니다.
 * 승인 전: 변수를 비워 두거나 NEXT_PUBLIC_ADSENSE_ENABLED=false
 */

export function getAdSenseClient(): string | null {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();
  if (!client || !client.startsWith("ca-pub-")) return null;
  return client;
}

/** ads.txt용 pub-xxxxxxxx (ca-pub- 에서 변환 가능) */
export function getAdSensePublisherId(): string | null {
  const explicit = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID?.trim();
  if (explicit?.startsWith("pub-")) return explicit;

  const client = getAdSenseClient();
  if (!client) return null;
  return client.replace(/^ca-/, "");
}

export function isAdSenseEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ADSENSE_ENABLED !== "true") return false;
  return !!getAdSenseClient();
}

export function getAdSlot(name: "home" | "about"): string | null {
  const slot =
    name === "home"
      ? process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME
      : process.env.NEXT_PUBLIC_ADSENSE_SLOT_ABOUT;
  return slot?.trim() || null;
}
