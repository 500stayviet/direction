import type { NaviApp } from "./types";
import { toSeoulNaviCityAddress } from "./seoulRegions";

/** false면 「항상 이 앱으로 열기」는 보이되 비활성·자동실행 끔 (모달에서 매번 선택). true면 다시 사용 */
export const NAVI_REMEMBER_ENABLED = false;

export const NAVI_APPS: {
  id: NaviApp;
  label: string;
  description: string;
  /** 선택 버튼 배경 이미지 */
  image: string;
  /** 이미지와 맞출 버튼 배경색 */
  buttonBg: string;
  /** true면 선택·실행 불가 */
  disabled?: boolean;
}[] = [
  {
    id: "tmap",
    label: "티맵",
    description: "",
    image: "/navi/tmap.png?v=4",
    buttonBg: "#FFFFFF",
  },
  {
    id: "navermap",
    label: "네이버 지도",
    description: "",
    image: "/navi/navermap.png?v=4",
    buttonBg: "#FFFFFF",
  },
  {
    id: "kakaomap",
    label: "카카오맵",
    description: "",
    image: "/navi/kakaomap.png?v=4",
    buttonBg: "#FADB05",
  },
  {
    id: "kakaonavi",
    label: "카카오내비",
    description: "",
    image: "/navi/kakaonavi.png?v=4",
    buttonBg: "#35373D",
    disabled: true,
  },
];

export function isNaviAppDisabled(app: NaviApp): boolean {
  return Boolean(NAVI_APPS.find((item) => item.id === app)?.disabled);
}

type NaviCoords = {
  lat: number;
  lng: number;
};

/**
 * 네비에 넘길 주소: 시 이름은 서울특별시로 통일.
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

  return toSeoulNaviCityAddress(text);
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
      // 어제(56d53eb)와 동일: 좌표 있으면 name+x+y, 없으면 name만으로 앱 실행
      if (hasCoords) {
        return `kakaonavi://navigate?name=${encodedName}&x=${lng}&y=${lat}&coord_type=wgs84`;
      }
      return `kakaonavi://navigate?name=${encodedName}`;
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

  if (isNaviAppDisabled(app)) return;

  // Tmap: 주소 검색만 (좌표 조회 없음)
  // 카카오맵·네이버지도: 좌표 있으면 길찾기
  let destCoords: NaviCoords | null = null;
  if (app === "navermap" || app === "kakaomap") {
    destCoords = await geocodeDestination(query);
  }

  const deepLink = buildNaviUrl(app, query, destCoords);
  if (!deepLink) return;

  // 웹/스토어로 폴백하지 않음 — 앱만 시도하고, 실패 시 현장동선에 그대로 둠
  window.location.href = deepLink;
}
