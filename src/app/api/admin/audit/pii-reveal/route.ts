import { NextResponse } from "next/server";
import {
  requireAdminSession,
  requireSuper,
} from "@/lib/adminAuth";
import { writeAdminAudit } from "@/lib/adminAudit";

/** 슈퍼: PII 열람(전화·호실 등) 기록 */
export async function POST(request: Request) {
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
      targetType?: string;
      targetId?: string;
      field?: string;
    };
    const targetType = (body.targetType ?? "entity").trim();
    const targetId = (body.targetId ?? "").trim();
    const field = (body.field ?? "pii").trim();

    await writeAdminAudit(auth.admin, auth.session, {
      action: "admin_pii_reveal",
      entityType: targetType,
      entityId: targetId,
      detail: { field },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "기록 실패",
      },
      { status: 500 }
    );
  }
}
