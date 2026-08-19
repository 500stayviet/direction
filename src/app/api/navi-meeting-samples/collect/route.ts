import { NextResponse } from "next/server";
import type { Schedule } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUserFromToken, getBearerToken } from "@/lib/serverAuth";
import { withApiErrorLog } from "@/lib/appErrorLog";
import {
  buildNaviMeetingParsedPayload,
  buildNaviMeetingRawPayload,
  listMissingNaviMeetingFields,
  shouldRecordNaviMeetingSample,
  type NaviMeetingRawPayload,
} from "@/lib/naviMeetingSampleCollect";

async function __POST_handler(request: Request) {
  try {
    const body = (await request.json()) as {
      schedule?: Schedule;
    };

    const schedule = body.schedule;
    if (!schedule?.id || !Array.isArray(schedule.properties)) {
      return NextResponse.json(
        { ok: false, message: "schedule이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    if (!shouldRecordNaviMeetingSample(schedule)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const auth = await getAuthUserFromToken(getBearerToken(request));

    const raw: NaviMeetingRawPayload = buildNaviMeetingRawPayload(schedule);
    const parsed = buildNaviMeetingParsedPayload(raw);
    const missingFields = listMissingNaviMeetingFields(raw);

    const admin = createAdminClient();
    const { error } = await admin.from("navi_meeting_parse_samples").upsert(
      {
        user_id: auth?.user.id ?? null,
        schedule_id: schedule.id,
        raw_payload: raw,
        parsed,
        missing_fields: missingFields,
        status: "new",
      },
      { onConflict: "schedule_id" }
    );

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "샘플 저장 실패",
      },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorLog(__POST_handler);

