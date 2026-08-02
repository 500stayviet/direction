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

type NaviCoords = {
  lat: number;
  lng: number;
};

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

/** 길찾기용 좌표만 조회. 도착지 표시 문구로는 쓰지 않음. */
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
    };
    if (
      typeof data.lat !== "number" ||
      typeof data.lng !== "number" ||
      !Number.isFinite(data.lat) ||
      !Number.isFinite(data.lng)
    ) {
      return null;
    }
    return { lat: data.lat, lng: data.lng };
  } catch {
    return null;
  }
}

/**
 * - 티맵·네이버·카카오맵: 도착 좌표가 있어야 목적지가 잡힘 (표시명은 작성 주소)
 *   좌표 없이 goalname만내면 티맵이 현위치/안전운행만 여는 경우가 많음
 * - 카카오내비: 웹 검색(주소 문자열)
 */
export function buildNaviUrl(
  app: NaviApp,
  address: string,
  coords?: NaviCoords | null
): string {
  const name = (toNaviAddress(address) || address).trim();
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
      return `https://map.kakao.com/?q=${encodedName}`;
    case "tmap":
      // goalx/goaly 없으면 목적지 미적용 → 현위치만 보이는 경우가 많음
      if (hasCoords) {
        return `tmap://route?goalname=${encodedName}&goalx=${lng}&goaly=${lat}`;
      }
      return `tmap://route?goalname=${encodedName}`;
    case "navermap":
      // dlat/dlng 필수. 이름만내면 목적지가 빠지고 현위치만 열림.
      if (hasCoords) {
        return `nmap://route/car?dlat=${lat}&dlng=${lng}&dname=${encodedName}&appname=direction-field`;
      }
      return `nmap://search?query=${encodedName}&appname=direction-field`;
    case "kakaomap":
      // ep(도착 좌표) 필요. 없으면 주소 검색으로 목적지라도 보이게.
      if (hasCoords) {
        return `kakaomap://route?ep=${lat},${lng}&en=${encodedName}&by=car`;
      }
      return `kakaomap://search?q=${encodedName}`;
    default:
      return buildWebMapFallback(name, app);
  }
}

/** 웹 폴백 — 앱별 검색 */
export function buildWebMapFallback(
  address: string,
  app?: NaviApp
): string {
  const name = (toNaviAddress(address) || address).trim();
  const encodedName = encodeURIComponent(name);
  if (app === "navermap") {
    return `https://map.naver.com/p/search/${encodedName}`;
  }
  return `https://map.kakao.com/?q=${encodedName}`;
}

export async function openNavi(app: NaviApp, address: string): Promise<void> {
  const query = toNaviAddress(address) || address;
  if (!query.trim()) return;

  // 티맵·네이버·카카오맵: 도착 좌표 (표시 문구는 항상 query)
  const needsCoords =
    app === "tmap" || app === "navermap" || app === "kakaomap";
  const coords = needsCoords ? await geocodeDestination(query) : null;

  const deepLink = buildNaviUrl(app, query, coords);
  const fallback = buildWebMapFallback(query, app);

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
