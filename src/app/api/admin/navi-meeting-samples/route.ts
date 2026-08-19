import { NextResponse } from "next/server";
import { requireAdminSession, requireSuper } from "@/lib/adminAuth";
import { withApiErrorLog } from "@/lib/appErrorLog";
import type {
  NaviMeetingSampleRow,
  NaviMeetingSampleStats,
} from "@/lib/naviMeetingSampleExport";
import type { NaviMeetingSampleStatus } from "@/lib/naviMeetingSampleCollect";
import type { NaviMeetingRawPayload } from "@/lib/naviMeetingSampleCollect";
import type { NaviMeetingParsedPayload } from "@/lib/naviMeetingSampleCollect";

function mapRow(row: Record<string, unknown>): NaviMeetingSampleRow {
  return {
    id: String(row.id),
    scheduleId: String(row.schedule_id ?? ""),
    rawPayload: (row.raw_payload ?? {}) as NaviMeetingRawPayload,
    parsed: (row.parsed ?? {}) as NaviMeetingParsedPayload,
    missingFields: Array.isArray(row.missing_fields)
      ? row.missing_fields.map(String)
      : [],
    status: row.status as NaviMeetingSampleStatus,
    createdAt: String(row.created_at),
    exportedAt: row.exported_at ? String(row.exported_at) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
  };
}

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

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const limit = Math.min(
      500,
      Math.max(20, Number(url.searchParams.get("limit") ?? 100) || 100)
    );

    let query = auth.admin
      .from("navi_meeting_parse_samples")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status === "new" || status === "exported" || status === "reviewed") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    const samples = (data ?? []).map((row) =>
      mapRow(row as Record<string, unknown>)
    );

    const { data: statRows, error: statError } = await auth.admin
      .from("navi_meeting_parse_samples")
      .select("status, created_at, raw_payload")
      .order("created_at", { ascending: false })
      .limit(2000);

    if (statError) {
      return NextResponse.json(
        { ok: false, message: statError.message },
        { status: 500 }
      );
    }

    const statRowsSafe = (statRows ?? []) as Array<
      Record<string, unknown> & {
        status?: NaviMeetingSampleStatus;
        created_at?: string;
        raw_payload?: NaviMeetingRawPayload;
      }
    >;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const stats: NaviMeetingSampleStats = {
      total: statRowsSafe.length,
      newCount: statRowsSafe.filter((r) => r.status === "new").length,
      exportedCount: statRowsSafe.filter((r) => r.status === "exported").length,
      reviewedCount: statRowsSafe.filter((r) => r.status === "reviewed").length,
      weekCount: statRowsSafe.filter((r) => {
        const createdAt = r.created_at ? Date.parse(String(r.created_at)) : 0;
        return createdAt >= weekAgo;
      }).length,
      scheduleCount: statRowsSafe.length,
      propertyCount: statRowsSafe.reduce((acc, r) => {
        const props = (r.raw_payload as NaviMeetingRawPayload | undefined)
          ?.properties;
        return acc + (props?.length ?? 0);
      }, 0),
    };

    return NextResponse.json({ ok: true, stats, samples });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "샘플 조회 실패",
      },
      { status: 500 }
    );
  }
}

export const GET = withApiErrorLog(__GET_handler);

