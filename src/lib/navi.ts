import type { NaviApp } from "./types";

export const NAVI_APPS: {
  id: NaviApp;
  label: string;
  description: string;
}[] = [
  {
    id: "kakaonavi",
    label: "카카오내비",
    description: "목적지(작성 주소) 검색",
  },
  {
    id: "tmap",
    label: "Tmap",
    description: "도착=작성 주소 · 출발은 앱이 잡음",
  },
  {
    id: "navermap",
    label: "네이버 지도",
    description: "도착=작성 주소 · 출발은 앱이 잡음",
  },
  {
    id: "kakaomap",
    label: "카카오맵",
    description: "도착=작성 주소 · 출발은 앱이 잡음",
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

/** 도착지 좌표만 조회. 출발(현재위치) 좌표는 절대 보내지 않음. */
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
 * 우리가 보내는 것 = 도착(작성 주소)만.
 * 출발 좌표·현재위치는 보내지 않음 → 앱 길찾기 화면의 출발란이 GPS로 채워짐.
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
      // 도착만: goal* / 출발(start*) 파라미터 없음
      if (hasCoords) {
        return `tmap://route?goalname=${encodedName}&goalx=${lng}&goaly=${lat}`;
      }
      // 좌표 없으면 검색으로 도착 주소라도 보이게
      return `tmap://search?name=${encodedName}`;
    case "navermap":
      // 도착만: dlat/dlng/dname — slat/slng/sname(출발) 넣지 않음
      if (hasCoords) {
        return `nmap://route/car?dlat=${lat}&dlng=${lng}&dname=${encodedName}&appname=direction-field`;
      }
      return `nmap://search?query=${encodedName}&appname=direction-field`;
    case "kakaomap":
      // 도착만: ep/en — sp(출발) 넣지 않음
      if (hasCoords) {
        return `kakaomap://route?ep=${lat},${lng}&en=${encodedName}&by=car`;
      }
      return `kakaomap://search?q=${encodedName}`;
    default:
      return buildWebMapFallback(name, app);
  }
}

/** 웹 폴백 — 도착 주소 검색 */
export function buildWebMapFallback(
  address: string,
  app?: NaviApp
): string {
  const name = (toNaviAddress(address) || address).trim();
  const encodedName = encodeURIComponent(name);
  if (app === "navermap") {
    return `https://map.naver.com/p/search/${encodedName}`;
  }
  if (app === "tmap") {
    return `https://www.tmap.co.kr/tmap2/mobile/tmap.jsp?name=${encodedName}`;
  }
  return `https://map.kakao.com/?q=${encodedName}`;
}

export async function openNavi(app: NaviApp, address: string): Promise<void> {
  const query = toNaviAddress(address) || address;
  if (!query.trim()) return;

  // 도착지 좌표만 (출발/현재위치 좌표는 조회·전송하지 않음)
  const needsDestCoords =
    app === "tmap" || app === "navermap" || app === "kakaomap";
  const destCoords = needsDestCoords
    ? await geocodeDestination(query)
    : null;

  const deepLink = buildNaviUrl(app, query, destCoords);
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
