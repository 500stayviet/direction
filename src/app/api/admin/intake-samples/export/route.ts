import { NextResponse } from "next/server";
import {
  requireAdminSession,
  requireSuper,
} from "@/lib/adminAuth";
import { writeAdminAudit } from "@/lib/adminAudit";
import type { IntakeParseResult } from "@/lib/intakeParse";
import {
  buildIntakeSampleExportBundle,
  type IntakeSampleRow,
} from "@/lib/intakeSampleExport";
import type {
  IntakeSampleSource,
  IntakeSampleStatus,
} from "@/lib/intakeSampleCollect";
import { withApiErrorLog } from "@/lib/appErrorLog";
import { toISODate } from "@/lib/date";

function mapRow(row: Record<string, unknown>): IntakeSampleRow {
  return {
    id: String(row.id),
    kind: row.kind as IntakeSampleRow["kind"],
    source: row.source as IntakeSampleSource,
    rawText: String(row.raw_text ?? ""),
    parsed: (row.parsed ?? {}) as IntakeParseResult,
    missingFields: Array.isArray(row.missing_fields)
      ? row.missing_fields.map(String)
      : [],
    status: row.status as IntakeSampleStatus,
    createdAt: String(row.created_at),
    exportedAt: row.exported_at ? String(row.exported_at) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
  };
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
      status?: IntakeSampleStatus | "all";
      markExported?: boolean;
    };

    const fromDate = body.fromDate?.trim() || daysAgoISO(7);
    const toDate = body.toDate?.trim() || toISODate(new Date());
    const statusFilter = body.status ?? "new";
    const markExported = body.markExported !== false;

    let query = auth.admin
      .from("intake_parse_samples")
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
    const bundle = buildIntakeSampleExportBundle(samples, periodLabel);

    if (markExported && samples.length > 0) {
      const ids = samples.map((s) => s.id);
      const now = new Date().toISOString();
      await auth.admin
        .from("intake_parse_samples")
        .update({ status: "exported", exported_at: now })
        .in("id", ids)
        .eq("status", "new");

      await writeAdminAudit(auth.admin, auth.session, {
        action: "admin_intake_samples_export",
        entityType: "intake_parse_samples",
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

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

export const POST = withApiErrorLog(__POST_handler);
