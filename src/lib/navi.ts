import type { NaviApp } from "./types";

export const NAVI_APPS: {
  id: NaviApp;
  label: string;
  description: string;
}[] = [
  {
    id: "kakaonavi",
    label: "카카오내비",
    description: "작성 주소를 그대로 전달",
  },
  {
    id: "tmap",
    label: "Tmap",
    description: "작성 주소를 그대로 전달",
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
 * 앱 스킴만 사용 (https 웹/스토어 폴백 없음).
 * → 카카오·티맵 웹의 "앱 실행/다운로드" 화면으로 안 넘어감.
 * 출발 좌표는 보내지 않음.
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
      // 주소 문자열만 전달 (좌표 변환 없음)
      return `kakaonavi://navigate?name=${encodedName}`;
    case "tmap":
      // 주소 문자열만 전달 (좌표 변환 없음)
      return `tmap://route?goalname=${encodedName}`;
    case "navermap":
      if (hasCoords) {
        return `nmap://route/car?dlat=${lat}&dlng=${lng}&dname=${encodedName}&appname=direction-field`;
      }
      return `nmap://search?query=${encodedName}&appname=direction-field`;
    case "kakaomap":
      if (hasCoords) {
        return `kakaomap://route?ep=${lat},${lng}&en=${encodedName}&by=car`;
      }
      return `kakaomap://search?q=${encodedName}`;
    default:
      return `tmap://route?goalname=${encodedName}`;
  }
}

export async function openNavi(app: NaviApp, address: string): Promise<void> {
  const query = toNaviAddress(address) || address;
  if (!query.trim()) return;

  // 네이버지도·카카오맵만 좌표 조회 / 카카오내비·Tmap은 주소 문자열만
  const needsGeocode = app === "navermap" || app === "kakaomap";
  const destCoords = needsGeocode ? await geocodeDestination(query) : null;
  const deepLink = buildNaviUrl(app, query, destCoords);

  // 웹/스토어로 폴백하지 않음 — 앱만 시도하고, 실패 시 현장동선에 그대로 둠
  window.location.href = deepLink;
}
