import { NextResponse } from "next/server";
import {
  requireAdminSession,
  requireSuper,
} from "@/lib/adminAuth";
import { writeAdminAudit } from "@/lib/adminAudit";
import {
  promoDateInputFromIso,
  promoRangeFromDateInputs,
} from "@/lib/promoCodes";

const SLUG = "early_bird";

function mapCampaign(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    id: String(row.id),
    slug: String(row.slug),
    benefit: String(row.benefit),
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    startsDate: promoDateInputFromIso(String(row.starts_at)),
    endsDate: promoDateInputFromIso(String(row.ends_at)),
    active: row.active !== false,
    memo: String(row.memo ?? ""),
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
      .from("promo_campaigns")
      .select("*")
      .eq("slug", SLUG)
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      campaign: mapCampaign(data as Record<string, unknown> | null),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "캠페인 조회 실패",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
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
      startsDate?: string;
      endsDate?: string;
      active?: boolean;
      memo?: string;
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

    const payload = {
      slug: SLUG,
      benefit: "basic_lifetime_free",
      starts_at: range.startsAt,
      ends_at: range.endsAt,
      active: body.active !== false,
      memo: (body.memo ?? "가입 기간 자동 평생 무료(기본)").trim(),
    };

    const { data: existing } = await auth.admin
      .from("promo_campaigns")
      .select("id")
      .eq("slug", SLUG)
      .maybeSingle();

    let data;
    let error;
    if (existing?.id) {
      ({ data, error } = await auth.admin
        .from("promo_campaigns")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single());
    } else {
      ({ data, error } = await auth.admin
        .from("promo_campaigns")
        .insert(payload)
        .select("*")
        .single());
    }

    if (error || !data) {
      return NextResponse.json(
        { ok: false, message: error?.message ?? "저장 실패" },
        { status: 500 }
      );
    }

    await writeAdminAudit(auth.admin, auth.session, {
      action: "admin_promo_campaign_save",
      entityType: "promo_campaign",
      entityId: String(data.id),
      detail: {
        slug: SLUG,
        startsDate: body.startsDate,
        endsDate: body.endsDate,
        active: payload.active,
      },
    });

    return NextResponse.json({
      ok: true,
      campaign: mapCampaign(data as Record<string, unknown>),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "캠페인 저장 실패",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
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
    const { error } = await auth.admin
      .from("promo_campaigns")
      .update({ active: false })
      .eq("slug", SLUG);
    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    await writeAdminAudit(auth.admin, auth.session, {
      action: "admin_promo_campaign_deactivate",
      entityType: "promo_campaign",
      entityId: SLUG,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "캠페인 종료 실패",
      },
      { status: 500 }
    );
  }
}
