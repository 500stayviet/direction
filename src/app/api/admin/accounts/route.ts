import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminAuth";

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
    let query = auth.admin
      .from("profiles")
      .select("id, username, shop_name, display_name, phone, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (safeQ) {
      query = query.or(
        [
          `username.ilike.%${safeQ}%`,
          `display_name.ilike.%${safeQ}%`,
          `shop_name.ilike.%${safeQ}%`,
          `phone.ilike.%${safeQ}%`,
        ].join(",")
      );
    }

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    const rows = data ?? [];
    const total = count ?? rows.length;

    return NextResponse.json({
      ok: true,
      q: rawQ,
      limit,
      offset,
      total,
      hasMore: offset + rows.length < total,
      accounts: rows.map((p) => ({
        id: p.id,
        username: p.username,
        shopName: p.shop_name,
        name: p.display_name,
        phone: p.phone || "",
        createdAt: p.created_at,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "계정 조회 실패",
      },
      { status: 500 }
    );
  }
}
