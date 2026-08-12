import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminAuth";
import { DEMO_ENTITY_ID_LIKE } from "@/lib/demoSeedPayload";
import { formatDepositRent } from "@/lib/format";

type Payload = Record<string, unknown>;

function mapPropertyRow(row: {
  id: string;
  user_id: string;
  payload: unknown;
  created_at: string;
  created_by_name?: string | null;
  username?: string;
  shopName?: string;
}) {
  const p = (row.payload ?? {}) as Payload;
  const dealType = String(p.dealType ?? "").trim() || "-";
  const roomType = String(p.roomType ?? "").trim() || "-";
  const deposit = Number(p.deposit ?? 0);
  const monthlyRent =
    p.monthlyRent == null || p.monthlyRent === ""
      ? undefined
      : Number(p.monthlyRent);
  const money = formatDepositRent(
    dealType,
    Number.isFinite(deposit) ? deposit : 0,
    monthlyRent != null && Number.isFinite(monthlyRent) ? monthlyRent : undefined
  );
  const address = String(p.address ?? "").trim();

  return {
    id: String(row.id),
    userId: String(row.user_id),
    roomType,
    dealType,
    money,
    address,
    createdByName: String(row.created_by_name ?? "").trim(),
    username: row.username ?? "",
    shopName: row.shopName ?? "",
    createdAt: String(row.created_at),
  };
}

function matchesQuery(
  row: ReturnType<typeof mapPropertyRow>,
  q: string
): boolean {
  if (!q) return true;
  const hay = [
    row.roomType,
    row.dealType,
    row.money,
    row.address,
    row.createdByName,
    row.username,
    row.shopName,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

export async function GET(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status }
    );
  }

  const url = new URL(request.url);
  const rawQ = (url.searchParams.get("q") ?? "").trim();
  const safeQ = rawQ.replace(/[%_,]/g, "").trim();
  const limit = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20)
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);

  try {
    // 검색 시 최근 건을 넉넉히 가져온 뒤 payload·등록자 기준 필터
    const fetchLimit = safeQ ? Math.min(500, Math.max(limit + offset, 200)) : limit;
    const fetchOffset = safeQ ? 0 : offset;

    const { data, error, count } = await auth.admin
      .from("listed_properties")
      .select(
        "id, user_id, payload, created_at, created_by_name",
        { count: "exact" }
      )
      .is("deleted_at", null)
      .not("id", "like", DEMO_ENTITY_ID_LIKE)
      .order("created_at", { ascending: false })
      .range(fetchOffset, fetchOffset + fetchLimit - 1);

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    const rows = data ?? [];
    const userIds = [...new Set(rows.map((r) => String(r.user_id)))];
    const profileMap = new Map<
      string,
      { username: string; shopName: string }
    >();
    if (userIds.length > 0) {
      const { data: profiles } = await auth.admin
        .from("profiles")
        .select("id, username, shop_name")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        profileMap.set(String(p.id), {
          username: String(p.username ?? ""),
          shopName: String(p.shop_name ?? ""),
        });
      }
    }

    const mapped = rows.map((r) => {
      const profile = profileMap.get(String(r.user_id));
      return mapPropertyRow({
        id: String(r.id),
        user_id: String(r.user_id),
        payload: r.payload,
        created_at: String(r.created_at),
        created_by_name: r.created_by_name as string | null,
        username: profile?.username,
        shopName: profile?.shopName,
      });
    });

    const filtered = safeQ
      ? mapped.filter((row) => matchesQuery(row, safeQ))
      : mapped;
    const page = safeQ
      ? filtered.slice(offset, offset + limit)
      : filtered;
    const total = safeQ ? filtered.length : count ?? filtered.length;

    return NextResponse.json({
      ok: true,
      q: rawQ,
      limit,
      offset,
      total,
      hasMore: offset + page.length < total,
      properties: page,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "매물 조회 실패",
      },
      { status: 500 }
    );
  }
}
