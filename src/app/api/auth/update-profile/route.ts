import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPhoneInput, normalizeShopName } from "@/lib/format";
import { withApiErrorLog } from "@/lib/appErrorLog";

type AdminClient = ReturnType<typeof createAdminClient>;

async function syncCreatorDisplayName(
  admin: AdminClient,
  userId: string,
  displayName: string
) {
  const tables = ["customers", "listed_properties", "schedules"] as const;
  for (const table of tables) {
    await admin
      .from(table)
      .update({ created_by_name: displayName })
      .eq("user_id", userId);
    await admin
      .from(table)
      .update({ created_by_name: displayName })
      .eq("created_by", userId);
  }
  await admin
    .from("workspace_members")
    .update({ display_name: displayName })
    .eq("user_id", userId);
}

async function __POST_handler(request: Request) {
  try {
    const body = (await request.json()) as {
      shopName?: string;
      name?: string;
      phone?: string;
      passwordHint?: string;
      accessToken?: string;
    };

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

    const passwordHint = (body.passwordHint ?? "").trim();
    if (!passwordHint) {
      return NextResponse.json(
        { ok: false, message: "비밀번호 힌트를 입력해 주세요." },
        { status: 400 }
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
      .select("username, created_at")
      .eq("id", userId)
      .maybeSingle();

    const username = String(
      profile?.username ?? meta.username ?? ""
    ).toLowerCase();
    if (!username) {
      return NextResponse.json(
        { ok: false, message: "계정 정보를 확인할 수 없습니다." },
        { status: 400 }
      );
    }

    const shopName = normalizeShopName(body.shopName ?? "");
    const name = (body.name ?? "").trim() || username;
    const phone = formatPhoneInput(body.phone ?? "");

    const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...meta,
        username,
        shop_name: shopName,
        display_name: name,
        phone,
        password_hint: passwordHint,
      },
    });
    if (metaError) {
      return NextResponse.json(
        { ok: false, message: `정보 수정에 실패했습니다. ${metaError.message}` },
        { status: 500 }
      );
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      username,
      shop_name: shopName,
      display_name: name,
      phone,
      password_hint: passwordHint,
    });
    if (profileError) {
      await admin.rpc("admin_upsert_profile", {
        p_id: userId,
        p_username: username,
        p_shop_name: shopName,
        p_display_name: name,
        p_phone: phone,
        p_password_hint: passwordHint,
      });
    }

    try {
      await syncCreatorDisplayName(admin, userId, name);
    } catch {
      /* 프로필은 저장됨. 공유자 표시 동기화 실패는 다음 저장·조회에서 보정 */
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: userId,
        username,
        shopName,
        name,
        phone,
        passwordHint,
        createdAt:
          profile?.created_at ??
          authUser.created_at ??
          new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "정보 수정 요청을 처리하지 못했습니다." },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorLog(__POST_handler);
