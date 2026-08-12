import { NextResponse } from "next/server";
import {
  requireAdminSession,
  requireSuper,
} from "@/lib/adminAuth";
import { writeAdminAudit } from "@/lib/adminAudit";
import { promoRangeFromDateInputs } from "@/lib/promoCodes";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
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

  const { id } = await params;
  const codeId = (id ?? "").trim();
  if (!codeId) {
    return NextResponse.json(
      { ok: false, message: "id가 필요합니다." },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json()) as {
      startsDate?: string;
      endsDate?: string;
      active?: boolean;
      memo?: string;
      maxUses?: number | null;
    };

    const patch: Record<string, unknown> = {};
    if (body.startsDate != null && body.endsDate != null) {
      const range = promoRangeFromDateInputs(body.startsDate, body.endsDate);
      if (!range) {
        return NextResponse.json(
          { ok: false, message: "날짜 형식이 올바르지 않습니다." },
          { status: 400 }
        );
      }
      patch.starts_at = range.startsAt;
      patch.ends_at = range.endsAt;
    }
    if (typeof body.active === "boolean") patch.active = body.active;
    if (body.memo != null) patch.memo = body.memo.trim();
    if (body.maxUses !== undefined) {
      patch.max_uses =
        body.maxUses == null ? null : Math.max(1, Number(body.maxUses) || 1);
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { ok: false, message: "변경할 내용이 없습니다." },
        { status: 400 }
      );
    }

    const { data, error } = await auth.admin
      .from("promo_codes")
      .update(patch)
      .eq("id", codeId)
      .select("id, code")
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, message: error?.message ?? "코드를 찾을 수 없습니다." },
        { status: error ? 500 : 404 }
      );
    }

    await writeAdminAudit(auth.admin, auth.session, {
      action: "admin_promo_code_update",
      entityType: "promo_code",
      entityId: codeId,
      detail: { code: data.code, ...patch },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "수정 실패",
      },
      { status: 500 }
    );
  }
}

/** soft delete — active=false */
export async function DELETE(request: Request, { params }: Params) {
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

  const { id } = await params;
  const codeId = (id ?? "").trim();

  try {
    const { data, error } = await auth.admin
      .from("promo_codes")
      .update({ active: false })
      .eq("id", codeId)
      .select("id, code")
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, message: error?.message ?? "코드를 찾을 수 없습니다." },
        { status: error ? 500 : 404 }
      );
    }

    await writeAdminAudit(auth.admin, auth.session, {
      action: "admin_promo_code_deactivate",
      entityType: "promo_code",
      entityId: codeId,
      detail: { code: data.code },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "삭제 실패",
      },
      { status: 500 }
    );
  }
}
