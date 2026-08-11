import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeUsername } from "@/lib/supabase/email";

const CONFIRM_PHRASE = "계정삭제에 동의합니다";
/** ~100년 — 로그인 불가 처리 (하드 삭제하지 않음) */
const BAN_DURATION = "876000h";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      confirmPhrase?: string;
      accessToken?: string;
    };

    const confirmPhrase = (body.confirmPhrase ?? "").trim();
    if (confirmPhrase !== CONFIRM_PHRASE) {
      return NextResponse.json(
        {
          ok: false,
          message: `「${CONFIRM_PHRASE}」를 정확히 입력해 주세요.`,
        },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get("authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
    const accessToken = bearer || (body.accessToken ?? "").trim();

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, message: "로그인이 필요합니다. 다시 로그인해 주세요." },
        { status: 401 }
      );
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          message:
            "서버 설정이 없습니다. Vercel/.env.local 에 SUPABASE_SERVICE_ROLE_KEY 를 확인해 주세요.",
        },
        { status: 503 }
      );
    }

    const { data: authData, error: authError } =
      await admin.auth.getUser(accessToken);
    const authUser = authData.user;
    if (authError || !authUser) {
      return NextResponse.json(
        { ok: false, message: "세션이 만료되었습니다. 다시 로그인해 주세요." },
        { status: 401 }
      );
    }

    const userId = authUser.id;
    const meta = authUser.user_metadata ?? {};

    const { data: profile } = await admin
      .from("profiles")
      .select(
        "username, shop_name, display_name, phone, password_hint, created_at"
      )
      .eq("id", userId)
      .maybeSingle();

    const username = normalizeUsername(
      String(profile?.username ?? meta.username ?? "")
    );
    if (!username) {
      return NextResponse.json(
        { ok: false, message: "계정 정보를 확인할 수 없습니다." },
        { status: 400 }
      );
    }

    const [{ data: customers }, { data: properties }, { data: schedules }] =
      await Promise.all([
        admin
          .from("customers")
          .select("id, payload, created_at, updated_at")
          .eq("user_id", userId),
        admin
          .from("listed_properties")
          .select("id, payload, created_at, updated_at")
          .eq("user_id", userId),
        admin
          .from("schedules")
          .select("id, payload, created_at, updated_at")
          .eq("user_id", userId),
      ]);

    const shopName = String(
      profile?.shop_name ?? meta.shop_name ?? "현장동선"
    );
    const displayName = String(
      profile?.display_name ?? meta.display_name ?? username
    );
    const phone = String(profile?.phone ?? meta.phone ?? "");
    const passwordHint = String(
      profile?.password_hint ?? meta.password_hint ?? ""
    );

    const archive = {
      username,
      former_user_id: userId,
      shop_name: shopName,
      display_name: displayName,
      phone,
      password_hint: passwordHint,
      profile_created_at:
        profile?.created_at ?? authUser.created_at ?? null,
      deleted_at: new Date().toISOString(),
      data_snapshot: {
        customers: customers ?? [],
        listed_properties: properties ?? [],
        schedules: schedules ?? [],
        counts: {
          customers: customers?.length ?? 0,
          listed_properties: properties?.length ?? 0,
          schedules: schedules?.length ?? 0,
        },
      },
    };

    const { error: archiveError } = await admin
      .from("deleted_accounts")
      .upsert(archive, { onConflict: "username" });

    if (archiveError) {
      return NextResponse.json(
        {
          ok: false,
          message: `계정 기록 보관에 실패했습니다. ${archiveError.message}`,
        },
        { status: 500 }
      );
    }

    // 하드 삭제하지 않음 — 보관·복구용으로 원본 유지, 로그인만 차단
    const { error: banError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: BAN_DURATION,
      user_metadata: {
        ...meta,
        account_deleted: true,
        account_deleted_at: archive.deleted_at,
      },
    });

    if (banError) {
      return NextResponse.json(
        {
          ok: false,
          message: `계정 비활성화에 실패했습니다. ${banError.message}`,
        },
        { status: 500 }
      );
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set("realty_app_user_v1", "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch {
    return NextResponse.json(
      { ok: false, message: "계정 삭제 요청을 처리하지 못했습니다." },
      { status: 500 }
    );
  }
}
