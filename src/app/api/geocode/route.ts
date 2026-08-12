import { NextRequest, NextResponse } from "next/server";
import { withApiErrorLog } from "@/lib/appErrorLog";

export type GeocodeResult = {
  lat: number;
  lng: number;
  /** 참고용. 네비 도착지 표시는 앱에 입력된 원본 주소를 씀 */
  name: string;
  source: "kakao" | "nominatim";
};

async function geocodeKakaoAddress(
  query: string
): Promise<GeocodeResult | null> {
  const key = process.env.KAKAO_REST_API_KEY?.trim();
  if (!key) return null;

  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", query);
  url.searchParams.set("size", "1");

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${key}` },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    documents?: Array<{
      address_name?: string;
      x?: string;
      y?: string;
      road_address?: { address_name?: string; x?: string; y?: string } | null;
      address?: {
        address_name?: string;
        x?: string;
        y?: string;
        main_address_no?: string;
      } | null;
    }>;
  };
  const doc = data.documents?.[0];
  if (!doc) return null;
  const lng = Number(doc.road_address?.x ?? doc.address?.x ?? doc.x);
  const lat = Number(doc.road_address?.y ?? doc.address?.y ?? doc.y);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    name:
      doc.address?.address_name ||
      doc.road_address?.address_name ||
      doc.address_name ||
      query,
    source: "kakao",
  };
}

/** 주소 검색 실패 시 키워드 검색 (건물명 등) */
async function geocodeKakaoKeyword(
  query: string
): Promise<GeocodeResult | null> {
  const key = process.env.KAKAO_REST_API_KEY?.trim();
  if (!key) return null;

  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", query);
  url.searchParams.set("size", "1");

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${key}` },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    documents?: Array<{
      place_name?: string;
      address_name?: string;
      road_address_name?: string;
      x?: string;
      y?: string;
    }>;
  };
  const doc = data.documents?.[0];
  if (!doc?.x || !doc?.y) return null;
  const lng = Number(doc.x);
  const lat = Number(doc.y);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    name: doc.address_name || doc.road_address_name || doc.place_name || query,
    source: "kakao",
  };
}

/**
 * Nominatim은 한국 지번에 약함.
 * 동(suburb) 단위만 나오면 좌표를 쓰지 않도록 null 반환 → 네비 앱이 주소 문자열로 검색.
 */
async function geocodeNominatim(query: string): Promise<GeocodeResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "kr");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "ko",
      "User-Agent": "direction-field-app/1.0 (realty navigation)",
    },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{
    lat?: string;
    lon?: string;
    display_name?: string;
    class?: string;
    type?: string;
    addresstype?: string;
    address?: {
      house_number?: string;
      road?: string;
      suburb?: string;
      neighbourhood?: string;
      borough?: string;
      city?: string;
      country?: string;
    };
  }>;
  const hit = data[0];
  if (!hit) return null;

  const addr = hit.address;
  const hasHouse = Boolean(addr?.house_number?.trim());
  const coarse =
    !hasHouse &&
    (hit.class === "boundary" ||
      hit.addresstype === "suburb" ||
      hit.addresstype === "neighbourhood" ||
      hit.addresstype === "borough" ||
      hit.addresstype === "city" ||
      hit.type === "administrative");
  if (coarse) return null;

  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // 한국식 표기 (국가명 제외). 네비 표시에는 보통 안 쓰이지만 참고용.
  const koreanName = [
    addr?.city,
    addr?.borough,
    addr?.suburb || addr?.neighbourhood,
    addr?.road,
    addr?.house_number,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    lat,
    lng,
    name: koreanName || query,
    source: "nominatim",
  };
}

async function __GET_handler(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }

  try {
    const result =
      (await geocodeKakaoAddress(q)) ||
      (await geocodeKakaoKeyword(q)) ||
      (await geocodeNominatim(q));
    if (!result) {
      // 좌표 없음 = 클라이언트가 원본 주소만으로 네비 앱 검색
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "geocode failed" }, { status: 502 });
  }
}

export const GET = withApiErrorLog(__GET_handler);
