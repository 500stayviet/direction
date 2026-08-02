import type { NaviApp } from "./types";

export const NAVI_APPS: {
  id: NaviApp;
  label: string;
  description: string;
}[] = [
  { id: "kakaonavi", label: "카카오내비", description: "카카오내비로 길안내" },
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

  // 흔한 호실·동호 표기 제거
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
 * 출발지=현재위치, 도착지=매물 주소 로 열리도록 URL 구성.
 * 좌표가 있으면 앱별 도착지 파라미터에 넣고, 없으면 도착지명만 전달.
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
      // 카카오내비: name+좌표 = 도착지, 출발은 현재 위치
      if (hasCoords) {
        return `kakaonavi://navigate?name=${encodedName}&x=${lng}&y=${lat}&coord_type=wgs84`;
      }
      // 좌표 없으면 구글 길찾기(도착지). map.kakao.com/?q= 는 검색·출발지로 잡히는 경우가 많음
      return `https://www.google.com/maps/dir/?api=1&destination=${encodedName}&travelmode=driving`;
    case "tmap":
      // goal* = 도착지. 출발 미지정 시 현재 위치
      if (hasCoords) {
        return `tmap://route?goalname=${encodedName}&goalx=${lng}&goaly=${lat}`;
      }
      return `tmap://route?goalname=${encodedName}`;
    case "navermap":
      // d* = 도착지. s* 미지정 시 현재 위치
      if (hasCoords) {
        return `nmap://route/car?dlat=${lat}&dlng=${lng}&dname=${encodedName}&appname=direction-field`;
      }
      return `https://www.google.com/maps/dir/?api=1&destination=${encodedName}&travelmode=driving`;
    default:
      return buildWebMapFallback(name, coords);
  }
}

/** 웹 폴백: 도착지 길찾기 (출발=현위치) */
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
  // Google Maps: destination만 주면 출발은 현재 위치
  return `https://www.google.com/maps/dir/?api=1&destination=${encodedName}&travelmode=driving`;
}

export async function openNavi(app: NaviApp, address: string): Promise<void> {
  const query = toNaviAddress(address) || address;
  if (!query.trim()) return;

  const coords = await geocodeDestination(query);
  const deepLink = buildNaviUrl(app, query, coords);
  const fallback = buildWebMapFallback(query, coords);

  const openedAt = Date.now();
  window.location.href = deepLink;

  window.setTimeout(() => {
    if (Date.now() - openedAt < 2500) {
      window.open(fallback, "_blank", "noopener,noreferrer");
    }
  }, 1200);
}
