import { NextResponse } from "next/server";
import {
  requireAdminSession,
  requireSuper,
} from "@/lib/adminAuth";
import { writeAdminAudit } from "@/lib/adminAudit";
import { withApiErrorLog } from "@/lib/appErrorLog";
import {
  auditLogsToCsv,
  fetchAdminAuditLogs,
  parseAuditLogDateRange,
} from "@/lib/adminAuditLogsQuery";

const MAX_EXPORT = 10_000;
const MAX_RANGE_DAYS = 366;

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00+09:00`).getTime();
  const b = new Date(`${to}T12:00:00+09:00`).getTime();
  return Math.round(Math.abs(b - a) / 86_400_000) + 1;
}

/** 슈퍼: 기간별 감사 로그 CSV 다운로드 */
async function __GET_handler(request: Request) {
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
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();
  const rawQ = (url.searchParams.get("q") ?? "").trim();

  if (!from || !to) {
    return NextResponse.json(
      { ok: false, message: "from, to (YYYY-MM-DD) 날짜가 필요합니다." },
      { status: 400 }
    );
  }

  const range = parseAuditLogDateRange(from, to);
  if (!range) {
    return NextResponse.json(
      { ok: false, message: "날짜 형식 또는 기간이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (daysBetween(from, to) > MAX_RANGE_DAYS) {
    return NextResponse.json(
      {
        ok: false,
        message: `한 번에 ${MAX_RANGE_DAYS}일 이하만 다운로드할 수 있습니다.`,
      },
      { status: 400 }
    );
  }

  try {
    const { rows, error } = await fetchAdminAuditLogs(auth.admin, {
      q: rawQ,
      from,
      to,
      limit: MAX_EXPORT,
    });
    if (error) {
      return NextResponse.json(
        { ok: false, message: error },
        { status: 500 }
      );
    }

    await writeAdminAudit(auth.admin, auth.session, {
      action: "admin_audit_log_export",
      entityType: "audit_logs",
      detail: { from, to, q: rawQ || undefined, count: rows.length },
    });

    const csv = auditLogsToCsv(rows);
    const filename = `audit-logs_${from}_${to}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "다운로드 실패",
      },
      { status: 500 }
    );
  }
}

export const GET = withApiErrorLog(__GET_handler);
