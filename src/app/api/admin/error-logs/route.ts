import { NextResponse } from "next/server";
import {
  requireAdminSession,
  requireSuper,
} from "@/lib/adminAuth";
import { withApiErrorLog } from "@/lib/appErrorLog";

/** 슈퍼: API 에러 로그 (Cursor 복붙용 report_text 포함) */
async function getHandler(request: Request) {
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
  const statusFilter = (url.searchParams.get("status") ?? "").trim();
  const since = (url.searchParams.get("since") ?? "").trim();
  const countOnly = url.searchParams.get("count") === "1";
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? 40) || 40)
  );

  try {
    if (countOnly) {
      let countQuery = auth.admin
        .from("app_error_logs")
        .select("id", { count: "exact", head: true });
      if (statusFilter === "4xx") {
        countQuery = countQuery.gte("status", 400).lt("status", 500);
      } else if (statusFilter === "5xx") {
        countQuery = countQuery.gte("status", 500).lt("status", 600);
      } else if (/^\d{3}$/.test(statusFilter)) {
        countQuery = countQuery.eq("status", Number(statusFilter));
      }
      if (since && !Number.isNaN(Date.parse(since))) {
        countQuery = countQuery.gt("created_at", new Date(since).toISOString());
      }
      const { count, error } = await countQuery;
      if (error) {
        return NextResponse.json(
          { ok: false, message: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({
        ok: true,
        count: count ?? 0,
        since: since || null,
        status: statusFilter || null,
      });
    }

    let query = auth.admin
      .from("app_error_logs")
      .select(
        "id, created_at, status, method, path, message, body_preview, stack, report_text, ip, user_agent"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (statusFilter === "4xx") {
      query = query.gte("status", 400).lt("status", 500);
    } else if (statusFilter === "5xx") {
      query = query.gte("status", 500).lt("status", 600);
    } else if (/^\d{3}$/.test(statusFilter)) {
      query = query.eq("status", Number(statusFilter));
    }

    if (since && !Number.isNaN(Date.parse(since))) {
      query = query.gt("created_at", new Date(since).toISOString());
    }

    if (rawQ) {
      const safe = rawQ.replace(/[%_,]/g, "").slice(0, 80);
      if (safe) {
        query = query.or(
          `path.ilike.%${safe}%,message.ilike.%${safe}%,report_text.ilike.%${safe}%`
        );
      }
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    const rows = (data ?? []).map((row) => ({
      id: String(row.id),
      createdAt: String(row.created_at),
      status: Number(row.status),
      method: String(row.method ?? ""),
      path: String(row.path ?? ""),
      message: String(row.message ?? ""),
      bodyPreview: String(row.body_preview ?? ""),
      stack: String(row.stack ?? ""),
      reportText: String(row.report_text ?? ""),
      ip: String(row.ip ?? ""),
      userAgent: String(row.user_agent ?? ""),
    }));

    return NextResponse.json({
      ok: true,
      q: rawQ,
      status: statusFilter || null,
      total: rows.length,
      rows,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "에러 로그 조회 실패",
      },
      { status: 500 }
    );
  }
}

export const GET = withApiErrorLog(getHandler);
