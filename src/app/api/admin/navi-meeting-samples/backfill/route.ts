import { NextResponse } from "next/server";
import { requireAdminSession, requireSuper } from "@/lib/adminAuth";
import { withApiErrorLog } from "@/lib/appErrorLog";
import { writeAdminAudit } from "@/lib/adminAudit";
import type { Schedule } from "@/lib/types";
import {
  buildNaviMeetingParsedPayload,
  buildNaviMeetingRawPayload,
  listMissingNaviMeetingFields,
  shouldRecordNaviMeetingSample,
} from "@/lib/naviMeetingSampleCollect";

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
    const body = (await request.json()) as { force?: boolean };
    const force = body.force === true;

    // 이미 들어간 schedule_id 목록 (force=false면 스킵용)
    const { data: existing, error: existingErr } = await auth.admin
      .from("navi_meeting_parse_samples")
      .select("schedule_id");
    if (existingErr) {
      return NextResponse.json(
        { ok: false, message: existingErr.message },
        { status: 500 }
      );
    }
    const existingSet = new Set<string>(
      (existing ?? []).map((r) => String((r as { schedule_id?: unknown }).schedule_id ?? ""))
    );

    const { data: scheduleRows, error: scheduleErr } = await auth.admin
      .from("schedules")
      .select("id,user_id,payload")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(20000);
    if (scheduleErr) {
      return NextResponse.json(
        { ok: false, message: scheduleErr.message },
        { status: 500 }
      );
    }

    const toUpsert: Array<{
      user_id: string | null;
      schedule_id: string;
      raw_payload: unknown;
      parsed: unknown;
      missing_fields: string[];
      status: "new";
    }> = [];

    for (const row of scheduleRows ?? []) {
      const payload = (row as Record<string, unknown>).payload ?? {};
      const schedule = payload as Schedule;
      // 혹시 payload에 id가 누락돼 있어도 안전하게 맞춤
      (schedule as Schedule).id = String((row as Record<string, unknown>).id);

      if (!shouldRecordNaviMeetingSample(schedule)) continue;

      const scheduleId = schedule.id;
      if (!force && existingSet.has(scheduleId)) continue;

      const raw = buildNaviMeetingRawPayload(schedule);
      const parsed = buildNaviMeetingParsedPayload(raw);
      const missingFields = listMissingNaviMeetingFields(raw);

      toUpsert.push({
        user_id: (row as Record<string, unknown>).user_id
          ? String((row as Record<string, unknown>).user_id)
          : null,
        schedule_id: scheduleId,
        raw_payload: raw,
        parsed,
        missing_fields: missingFields,
        status: "new",
      });
    }

    if (toUpsert.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, scanned: scheduleRows?.length ?? 0 });
    }

    const { error: upsertErr } = await auth.admin
      .from("navi_meeting_parse_samples")
      .upsert(toUpsert, { onConflict: "schedule_id" });

    if (upsertErr) {
      return NextResponse.json(
        { ok: false, message: upsertErr.message },
        { status: 500 }
      );
    }

    await writeAdminAudit(auth.admin, auth.session, {
      action: "admin_navi_meeting_samples_backfill",
      entityType: "navi_meeting_parse_samples",
      detail: {
        inserted: toUpsert.length,
        scanned: scheduleRows?.length ?? 0,
        force,
      },
    });

    return NextResponse.json({
      ok: true,
      inserted: toUpsert.length,
      scanned: scheduleRows?.length ?? 0,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "backfill 실패",
      },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorLog(__POST_handler);

