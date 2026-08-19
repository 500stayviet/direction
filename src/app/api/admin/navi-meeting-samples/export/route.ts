import { NextResponse } from "next/server";
import { requireAdminSession, requireSuper } from "@/lib/adminAuth";
import { withApiErrorLog } from "@/lib/appErrorLog";
import type {
  NaviMeetingSampleRow,
} from "@/lib/naviMeetingSampleExport";
import { buildNaviMeetingSampleExportBundle } from "@/lib/naviMeetingSampleExport";
import type { NaviMeetingSampleStatus } from "@/lib/naviMeetingSampleCollect";
import { writeAdminAudit } from "@/lib/adminAudit";
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

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  // toISODate is not imported intentionally to keep this route independent
  return d.toISOString().slice(0, 10);
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function __POST_handler(request: Request) {
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
    const body = (await request.json()) as {
      fromDate?: string;
      toDate?: string;
      status?: NaviMeetingSampleStatus | "all";
      markExported?: boolean;
    };

    const fromDate = body.fromDate?.trim() || daysAgoISO(7);
    const toDate = body.toDate?.trim() || toISODate(new Date());
    const statusFilter = body.status ?? "new";
    const markExported = body.markExported !== false;

    let query = auth.admin
      .from("navi_meeting_parse_samples")
      .select("*")
      .gte("created_at", `${fromDate}T00:00:00.000Z`)
      .lte("created_at", `${toDate}T23:59:59.999Z`)
      .order("created_at", { ascending: false })
      .limit(500);

    if (
      statusFilter === "new" ||
      statusFilter === "exported" ||
      statusFilter === "reviewed"
    ) {
      query = query.eq("status", statusFilter);
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

    const periodLabel = `${fromDate} ~ ${toDate}`;
    const bundle = buildNaviMeetingSampleExportBundle(samples, periodLabel);

    if (markExported && samples.length > 0) {
      const ids = samples.map((s) => s.id);
      const now = new Date().toISOString();
      await auth.admin
        .from("navi_meeting_parse_samples")
        .update({ status: "exported", exported_at: now })
        .in("id", ids)
        .eq("status", "new");

      await writeAdminAudit(auth.admin, auth.session, {
        action: "admin_navi_meeting_samples_export",
        entityType: "navi_meeting_parse_samples",
        detail: { fromDate, toDate, count: samples.length },
      });
    }

    return NextResponse.json({
      ok: true,
      period: periodLabel,
      count: samples.length,
      json: bundle.json,
      summary: bundle.summary,
      cursorPrompt: bundle.cursorPrompt,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "export 실패",
      },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorLog(__POST_handler);

