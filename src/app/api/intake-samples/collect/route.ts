import { NextResponse } from "next/server";
import {
  hashIntakeSampleText,
  shouldRecordIntakeSample,
} from "@/lib/intakeSampleCollect";
import type { IntakeKind, IntakeParseResult } from "@/lib/intakeParse";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUserFromToken, getBearerToken } from "@/lib/serverAuth";
import { withApiErrorLog } from "@/lib/appErrorLog";

async function __POST_handler(request: Request) {
  try {
    const body = (await request.json()) as {
      kind?: IntakeKind;
      source?: "message" | "photo";
      rawText?: string;
      parsed?: IntakeParseResult;
      missingFields?: string[];
    };

    const kind = body.kind;
    const source = body.source;
    const rawText = String(body.rawText ?? "").trim();
    if (kind !== "customer" && kind !== "property") {
      return NextResponse.json(
        { ok: false, message: "kind가 올바르지 않습니다." },
        { status: 400 }
      );
    }
    if (source !== "message" && source !== "photo") {
      return NextResponse.json(
        { ok: false, message: "source가 올바르지 않습니다." },
        { status: 400 }
      );
    }
    if (!shouldRecordIntakeSample(rawText)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const auth = await getAuthUserFromToken(getBearerToken(request));
    const parsed = body.parsed ?? {};
    const missingFields = Array.isArray(body.missingFields)
      ? body.missingFields.filter((v) => typeof v === "string")
      : [];

    const admin = createAdminClient();
    const { error } = await admin.from("intake_parse_samples").insert({
      user_id: auth?.user.id ?? null,
      kind,
      source,
      raw_text: rawText,
      parsed,
      missing_fields: missingFields,
      raw_hash: hashIntakeSampleText(rawText),
      status: "new",
    });

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
