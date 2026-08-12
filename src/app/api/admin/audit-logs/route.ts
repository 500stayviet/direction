import { NextResponse } from "next/server";
import {
  requireAdminSession,
  requireSuper,
} from "@/lib/adminAuth";

/** 슈퍼: 관리자·운영 감사 로그 조회 */
export async function GET(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status }
    );
  }
  const superOk = requireSuper(auth.session);
  if (!superOk.ok) {
    return NextResponse.json(
      { ok: false, message: superOk.message },
      { status: superOk.status }
    );
  }

  const url = new URL(request.url);
  const rawQ = (url.searchParams.get("q") ?? "").trim();
  const safeQ = rawQ.replace(/[%_,]/g, "").trim();
  const limit = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("limit") ?? 30) || 30)
  );

  try {
    let query = auth.admin
      .from("audit_logs")
      .select(
        "id, actor_name, action, entity_type, entity_id, detail, created_at",
        { count: "exact" }
      )
      .like("action", "admin_%")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (safeQ) {
      query = query.or(
        [
          `actor_name.ilike.%${safeQ}%`,
          `action.ilike.%${safeQ}%`,
          `entity_id.ilike.%${safeQ}%`,
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

    return NextResponse.json({
      ok: true,
      q: rawQ,
      total: count ?? data?.length ?? 0,
      rows: (data ?? []).map((row) => ({
        id: row.id,
        actorName: row.actor_name,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        detail: row.detail ?? {},
        createdAt: row.created_at,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "로그 조회 실패",
      },
      { status: 500 }
    );
  }
}
