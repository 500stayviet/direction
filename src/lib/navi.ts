import type { NaviApp } from "./types";

export const NAVI_APPS: {
  id: NaviApp;
  label: string;
  description: string;
}[] = [
  {
    id: "kakaonavi",
    label: "카카오내비",
    description: "목적지까지 길안내 (네비)",
  },
  {
    id: "tmap",
    label: "Tmap",
    description: "목적지까지 길안내 (네비)",
  },
  {
    id: "navermap",
    label: "네이버 지도",
    description: "현재 위치 → 목적지 길찾기",
  },
  {
    id: "kakaomap",
    label: "카카오맵",
    description: "현재 위치 → 목적지 길찾기",
  },
];

/**
 * 네비에 넘길 주소: 작성한 내용 그대로(한국식 공백 구분).
 * 끝에 붙은 호실(101동 1203호 등)만 제거. 지번은 유지.
 */
export function toNaviAddress(address: string): string {
  let text = address.trim();
  if (!text) return "";

  text = text
    .replace(/\s*\d+\s*동\s*\d+\s*호\s*$/g, "")
    .replace(/\s*\d+\s*동\s*$/g, "")
    .replace(/\s*\d+\s*호\s*$/g, "")
    .replace(/\s*[·•|,]\s*$/g, "")
    .trim();

  return text;
}

/**
 * 앱별 URL — 좌표·지오코딩 없이 작성 주소 문자열만 전달.
 * (좌표를 넘기면 앱이 핀을 역지오코딩해 지번이 빠지고 서양식 표기가 됨)
 */
export function buildNaviUrl(app: NaviApp, address: string): string {
  const name = (toNaviAddress(address) || address).trim();
  const encodedName = encodeURIComponent(name);

  switch (app) {
    case "kakaonavi":
      return `https://map.kakao.com/?q=${encodedName}`;
    case "tmap":
      return `tmap://route?goalname=${encodedName}`;
    case "navermap":
      return `nmap://route/car?dname=${encodedName}&appname=direction-field`;
    case "kakaomap":
      return `kakaomap://route?en=${encodedName}&by=car`;
    default:
      return buildWebMapFallback(name);
  }
}

/** 웹 폴백 — 검색어 = 작성 주소 */
export function buildWebMapFallback(address: string): string {
  const name = (toNaviAddress(address) || address).trim();
  return `https://map.kakao.com/?q=${encodeURIComponent(name)}`;
}

export async function openNavi(app: NaviApp, address: string): Promise<void> {
  const query = toNaviAddress(address) || address;
  if (!query.trim()) return;

  const deepLink = buildNaviUrl(app, query);
  const fallback = buildWebMapFallback(query);

  if (deepLink.startsWith("http://") || deepLink.startsWith("https://")) {
    window.location.href = deepLink;
    return;
  }

  const openedAt = Date.now();
  window.location.href = deepLink;

  window.setTimeout(() => {
    if (Date.now() - openedAt > 2500) return;
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      return;
    }
    window.location.href = fallback;
  }, 1400);
}
