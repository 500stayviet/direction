import type { NaviApp } from "./types";

export const NAVI_APPS: {
  id: NaviApp;
  label: string;
  description: string;
}[] = [
  {
    id: "kakaonavi",
    label: "카카오내비",
    description: "목적지까지 길안내 (내비)",
  },
  {
    id: "tmap",
    label: "Tmap",
    description: "목적지까지 길안내 (내비)",
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

export type NaviCoords = {
  lat: number;
  lng: number;
  name?: string;
};

/**
 * 네비용 주소: 구·동·지번까지만.
 * 호실(101동 1203호 등)·건물명 꼬리표는 제거.
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

async function geocodeDestination(
  address: string
): Promise<NaviCoords | null> {
  try {
    const res = await fetch(
      `/api/geocode?q=${encodeURIComponent(address)}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      lat?: number;
      lng?: number;
      name?: string;
    };
    if (
      typeof data.lat !== "number" ||
      typeof data.lng !== "number" ||
      !Number.isFinite(data.lat) ||
      !Number.isFinite(data.lng)
    ) {
      return null;
    }
    return { lat: data.lat, lng: data.lng, name: data.name };
  } catch {
    return null;
  }
}

/**
 * 앱별 URL
 * - 카카오내비·티맵: 목적지 중심 (내비)
 * - 네이버지도·카카오맵: 현재위치 → 목적지 길찾기
 *
 * 참고: 웹에서 `kakaonavi://` 는 앱키 인증이 없어 실패하는 경우가 많아,
 * 카카오내비는 목적지 링크(map.kakao.com/link/to)로 엽니다.
 */
export function buildNaviUrl(
  app: NaviApp,
  address: string,
  coords?: NaviCoords | null
): string {
  const name = (coords?.name || toNaviAddress(address) || address).trim();
  const encodedName = encodeURIComponent(name);
  const lat = coords?.lat;
  const lng = coords?.lng;
  const hasCoords =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  switch (app) {
    case "kakaonavi":
      // 목적지 지정 (웹에서 내비 앱키 없이 동작하는 방식)
      if (hasCoords) {
        return `https://map.kakao.com/link/to/${encodedName},${lat},${lng}`;
      }
      return `https://map.kakao.com/?q=${encodedName}`;
    case "tmap":
      // 목적지(goal). 출발 미지정 = 현재 위치에서 내비
      if (hasCoords) {
        return `tmap://route?goalname=${encodedName}&goalx=${lng}&goaly=${lat}`;
      }
      return `tmap://route?goalname=${encodedName}`;
    case "navermap":
      // 길찾기: 출발=현재위치(기본), 도착=매물
      if (hasCoords) {
        return `nmap://route/car?dlat=${lat}&dlng=${lng}&dname=${encodedName}&appname=direction-field`;
      }
      return `nmap://search?query=${encodedName}&appname=direction-field`;
    case "kakaomap":
      // 길찾기: 출발=현재위치(기본), 도착=매물
      if (hasCoords) {
        return `kakaomap://route?ep=${lat},${lng}&en=${encodedName}&by=car`;
      }
      return `https://map.kakao.com/?q=${encodedName}`;
    default:
      return buildWebMapFallback(name, coords);
  }
}

/** 웹 폴백 */
export function buildWebMapFallback(
  address: string,
  coords?: NaviCoords | null
): string {
  const name = (coords?.name || toNaviAddress(address) || address).trim();
  const encodedName = encodeURIComponent(name);
  if (
    coords &&
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng)
  ) {
    return `https://map.kakao.com/link/to/${encodedName},${coords.lat},${coords.lng}`;
  }
  return `https://map.kakao.com/?q=${encodedName}`;
}

export async function openNavi(app: NaviApp, address: string): Promise<void> {
  const query = toNaviAddress(address) || address;
  if (!query.trim()) return;

  const coords = await geocodeDestination(query);
  const deepLink = buildNaviUrl(app, query, coords);
  const fallback = buildWebMapFallback(query, coords);

  // 이미 https 웹 링크면 폴백 타이머 불필요
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
