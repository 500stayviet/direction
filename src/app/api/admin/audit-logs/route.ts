import { NextResponse } from "next/server";
import {
  requireAdminSession,
  requireSuper,
} from "@/lib/adminAuth";
import { fetchAdminAuditLogs } from "@/lib/adminAuditLogsQuery";

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
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? 30) || 30)
  );

  try {
    const { rows, error } = await fetchAdminAuditLogs(auth.admin, {
      q: rawQ,
      from: from || undefined,
      to: to || undefined,
      limit,
    });
    if (error) {
      return NextResponse.json(
        { ok: false, message: error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      q: rawQ,
      from: from || null,
      to: to || null,
      total: rows.length,
      rows,
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
