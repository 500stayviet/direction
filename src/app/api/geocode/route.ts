import { NextRequest, NextResponse } from "next/server";

export type GeocodeResult = {
  lat: number;
  lng: number;
  name: string;
};

async function geocodeKakao(query: string): Promise<GeocodeResult | null> {
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
      address?: { address_name?: string; x?: string; y?: string } | null;
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
      doc.road_address?.address_name ||
      doc.address?.address_name ||
      doc.address_name ||
      query,
  };
}

async function geocodeNominatim(query: string): Promise<GeocodeResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "kr");
  url.searchParams.set("limit", "1");

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
  }>;
  const hit = data[0];
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, name: hit.display_name || query };
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }

  try {
    const result =
      (await geocodeKakao(q)) || (await geocodeNominatim(q));
    if (!result) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "geocode failed" }, { status: 502 });
  }
}
