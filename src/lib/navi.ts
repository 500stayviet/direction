import type { NaviApp } from "./types";

export const NAVI_APPS: {
  id: NaviApp;
  label: string;
  description: string;
}[] = [
  {
    id: "system",
    label: "기본 지도 앱",
    description: "전화처럼 폰에 설정된 지도 앱·선택 화면으로 엽니다",
  },
  {
    id: "kakaonavi",
    label: "카카오맵",
    description: "카카오맵 길안내 (현재 위치 → 도착지)",
  },
  { id: "tmap", label: "Tmap", description: "티맵으로 길안내" },
  { id: "navermap", label: "네이버 지도", description: "네이버 지도로 길안내" },
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
 * 폰 설정·설치 앱에 맡기는 geo: 링크 (tel: 과 같은 방식).
 * 안드로이드: 기본 지도 앱 또는 선택 화면
 * iOS: 보통 Apple 지도
 */
export function buildSystemNaviUrl(
  address: string,
  coords?: NaviCoords | null
): string {
  const name = (coords?.name || toNaviAddress(address) || address).trim();
  const q = encodeURIComponent(name);
  if (
    coords &&
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng)
  ) {
    return `geo:${coords.lat},${coords.lng}?q=${q}`;
  }
  return `geo:0,0?q=${q}`;
}

/**
 * 출발지=현재위치, 도착지=매물 주소 로 열리도록 URL 구성.
 *
 * 주의: `kakaonavi://navigate` 는 웹에서 인증 실패함 → 카카오맵 스킴 사용.
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
    case "system":
      return buildSystemNaviUrl(address, coords);
    case "kakaonavi":
      if (hasCoords) {
        return `kakaomap://route?ep=${lat},${lng}&en=${encodedName}&by=car`;
      }
      return `https://map.kakao.com/?q=${encodedName}`;
    case "tmap":
      if (hasCoords) {
        return `tmap://route?goalname=${encodedName}&goalx=${lng}&goaly=${lat}`;
      }
      return `tmap://route?goalname=${encodedName}`;
    case "navermap":
      if (hasCoords) {
        return `nmap://route/car?dlat=${lat}&dlng=${lng}&dname=${encodedName}&appname=direction-field`;
      }
      return `nmap://search?query=${encodedName}&appname=direction-field`;
    default:
      return buildWebMapFallback(name, coords);
  }
}

/** 웹 폴백: 도착지 길찾기 */
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

function launchHref(href: string, fallback: string): void {
  const openedAt = Date.now();
  window.location.href = href;

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

export async function openNavi(app: NaviApp, address: string): Promise<void> {
  const query = toNaviAddress(address) || address;
  if (!query.trim()) return;

  const coords = await geocodeDestination(query);
  const deepLink = buildNaviUrl(app, query, coords);
  const fallback = buildWebMapFallback(query, coords);
  launchHref(deepLink, fallback);
}

/** 전화(tel:)처럼 폰 기본·선택 UI로 바로 열기 */
export async function openSystemNavi(address: string): Promise<void> {
  return openNavi("system", address);
}
