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

export function buildNaviUrl(app: NaviApp, address: string): string {
  const encoded = encodeURIComponent(toNaviAddress(address) || address);

  switch (app) {
    case "kakaonavi":
      return `kakaonavi://navigate?name=${encoded}&coord_type=wgs84`;
    case "tmap":
      return `tmap://route?goalname=${encoded}`;
    case "navermap":
      return `nmap://route/car?dname=${encoded}&appname=realty-field`;
    default:
      return `https://map.kakao.com/?q=${encoded}`;
  }
}

export function buildWebMapFallback(address: string): string {
  const q = toNaviAddress(address) || address;
  return `https://map.kakao.com/?q=${encodeURIComponent(q)}`;
}

export function openNavi(app: NaviApp, address: string): void {
  const query = toNaviAddress(address) || address;
  if (!query.trim()) return;
  const deepLink = buildNaviUrl(app, query);
  const fallback = buildWebMapFallback(query);

  const openedAt = Date.now();
  window.location.href = deepLink;

  window.setTimeout(() => {
    if (Date.now() - openedAt < 2500) {
      window.open(fallback, "_blank", "noopener,noreferrer");
    }
  }, 1200);
}
