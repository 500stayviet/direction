import { NextResponse } from "next/server";
import {
  requireAdminSession,
  requireSuper,
} from "@/lib/adminAuth";
import { writeAdminAudit } from "@/lib/adminAudit";
import {
  generatePromoCode,
  normalizePromoCode,
  promoDateInputFromIso,
  promoRangeFromDateInputs,
} from "@/lib/promoCodes";

function mapRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    code: String(row.code),
    benefit: String(row.benefit),
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    startsDate: promoDateInputFromIso(String(row.starts_at)),
    endsDate: promoDateInputFromIso(String(row.ends_at)),
    maxUses: row.max_uses == null ? null : Number(row.max_uses),
    useCount: Number(row.use_count ?? 0),
    active: row.active !== false,
    memo: String(row.memo ?? ""),
    createdByName: String(row.created_by_name ?? ""),
    createdAt: String(row.created_at),
  };
}

export async function GET(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status }
    );
  }

  try {
    const { data, error } = await auth.admin
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      codes: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "프로모 코드 조회 실패",
      },
      { status: 500 }
    );
  }
}

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
      code?: string;
      startsDate?: string;
      endsDate?: string;
      maxUses?: number | null;
      memo?: string;
      benefit?: string;
      autoGenerate?: boolean;
    };

    const range = promoRangeFromDateInputs(
      String(body.startsDate ?? ""),
      String(body.endsDate ?? "")
    );
    if (!range) {
      return NextResponse.json(
        { ok: false, message: "시작·종료 날짜를 확인해 주세요." },
        { status: 400 }
      );
    }

    let code = normalizePromoCode(body.code ?? "");
    if (body.autoGenerate || !code) {
      code = generatePromoCode();
      for (let i = 0; i < 5; i += 1) {
        const { data: exists } = await auth.admin
          .from("promo_codes")
          .select("id")
          .eq("code", code)
          .maybeSingle();
        if (!exists) break;
        code = generatePromoCode();
      }
    }
    if (!code) {
      return NextResponse.json(
        { ok: false, message: "코드를 입력하거나 자동 생성해 주세요." },
        { status: 400 }
      );
    }

    const benefit = (body.benefit ?? "basic_lifetime_free").trim();
    const maxUses =
      body.maxUses == null || body.maxUses === undefined
        ? null
        : Math.max(1, Number(body.maxUses) || 1);

    const actor = `${auth.session.title}:${auth.session.displayName}`;

    const { data, error } = await auth.admin
      .from("promo_codes")
      .insert({
        code,
        benefit,
        starts_at: range.startsAt,
        ends_at: range.endsAt,
        max_uses: maxUses,
        memo: (body.memo ?? "").trim(),
        created_by_name: actor,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 400 }
      );
    }

    await writeAdminAudit(auth.admin, auth.session, {
      action: "admin_promo_code_create",
      entityType: "promo_code",
      entityId: String(data.id),
      detail: { code, benefit, startsDate: body.startsDate, endsDate: body.endsDate },
    });

    return NextResponse.json({
      ok: true,
      code: mapRow(data as Record<string, unknown>),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "프로모 코드 생성 실패",
      },
      { status: 500 }
    );
  }
}
