import type { NaviApp } from "./types";

export const NAVI_APPS: {
  id: NaviApp;
  label: string;
  description: string;
}[] = [
  {
    id: "tmap",
    label: "Tmap (추천)",
    description: "작성 주소를 검색창에 넣어 엽니다",
  },
  {
    id: "kakaomap",
    label: "카카오맵",
    description: "도착=작성 주소 · 출발은 앱이 잡음",
  },
  {
    id: "navermap",
    label: "네이버 지도",
    description: "도착=작성 주소 · 출발은 앱이 잡음",
  },
  {
    id: "kakaonavi",
    label: "카카오내비",
    description: "주소만 전달이 막혀 있어 사용할 수 없습니다",
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
      // 카카오내비는 주소만 넣는 URL을 공식 지원하지 않음
      // (비공식 스킴 → 파라미터/인증 오류). API 키 없이는 불가.
      return "";
    case "tmap":
      // route+goalname만이면 목적지가 비고 현재위치가 잡힘 → 검색으로 주소 입력
      return `tmap://search?name=${encodedName}`;
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
      return `tmap://search?name=${encodedName}`;
  }
}

export async function openNavi(app: NaviApp, address: string): Promise<void> {
  const query = toNaviAddress(address) || address;
  if (!query.trim()) return;

  if (app === "kakaonavi") {
    window.alert(
      "카카오내비는 앱 정책상 주소만 자동으로 넣을 수 없습니다.\nTmap(추천)·카카오맵·네이버지도를 이용해 주세요."
    );
    return;
  }

  // 네이버지도·카카오맵: 좌표 있으면 길찾기, 없으면 주소 검색
  // Tmap: API 없이 검색창에 주소만 넣어 열기
  let destCoords: NaviCoords | null = null;
  if (app === "navermap" || app === "kakaomap") {
    destCoords = await geocodeDestination(query);
  }

  const deepLink = buildNaviUrl(app, query, destCoords);
  if (!deepLink) return;

  // 웹/스토어로 폴백하지 않음 — 앱만 시도하고, 실패 시 현장동선에 그대로 둠
  window.location.href = deepLink;
}
