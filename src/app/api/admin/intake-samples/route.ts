import { NextResponse } from "next/server";
import {
  requireAdminSession,
  requireSuper,
} from "@/lib/adminAuth";
import type { IntakeParseResult } from "@/lib/intakeParse";
import type {
  IntakeSampleSource,
  IntakeSampleStatus,
} from "@/lib/intakeSampleCollect";
import {
  summarizeIntakeSampleStats,
  type IntakeSampleRow,
} from "@/lib/intakeSampleExport";
import { withApiErrorLog } from "@/lib/appErrorLog";
import {
  INTAKE_AI_LIMITS,
  isIntakeAiKeyConfigured,
} from "@/lib/intakeAiGuard";

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
      .from("intake_parse_samples")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (
      status === "new" ||
      status === "exported" ||
      status === "reviewed"
    ) {
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
      .from("intake_parse_samples")
      .select("status, source, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);

    if (statError) {
      return NextResponse.json(
        { ok: false, message: statError.message },
        { status: 500 }
      );
    }

    const stats = summarizeIntakeSampleStats(
      (statRows ?? []).map((row) =>
        mapRow({ ...row, raw_text: "", parsed: {}, missing_fields: [] })
      )
    );

    return NextResponse.json({
      ok: true,
      stats,
      samples,
      ai: {
        keyConfigured: isIntakeAiKeyConfigured(),
        keyEnv: "DEEPSEEK_API_KEY",
        keyLocalFile: ".env.local",
        keyDeploy: "Vercel → Settings → Environment Variables",
        limits: {
          userPerMinute: INTAKE_AI_LIMITS.userPerMinute,
          userPerHour: INTAKE_AI_LIMITS.userPerHour,
          userPerDay: INTAKE_AI_LIMITS.userPerDay,
        },
      },
    });
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
