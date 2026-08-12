import { NextResponse } from "next/server";
import {
  hashAdminPassword,
  requireAdminSession,
  requireSuper,
} from "@/lib/adminAuth";
import { writeAdminAudit } from "@/lib/adminAudit";
import { withApiErrorLog } from "@/lib/appErrorLog";

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

  const { data, error } = await auth.admin
    .from("admin_users")
    .select("id, username, display_name, title, role, active, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, staff: data ?? [] });
}

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
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      displayName?: string;
      title?: string;
      role?: "super" | "staff";
    };
    const username = (body.username ?? "").trim().toLowerCase();
    const password = (body.password ?? "").trim();
    const displayName = (body.displayName ?? "").trim() || username;
    const title = (body.title ?? "").trim() || "직원";
    const role = body.role === "super" ? "super" : "staff";

    if (!username || username.length < 3) {
      return NextResponse.json(
        { ok: false, message: "아이디는 3자 이상이어야 합니다." },
        { status: 400 }
      );
    }
    if (!password || password.length < 4) {
      return NextResponse.json(
        { ok: false, message: "비밀번호는 4자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    const { data: exists } = await auth.admin
      .from("admin_users")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (exists) {
      return NextResponse.json(
        { ok: false, message: "이미 있는 관리자 아이디입니다." },
        { status: 409 }
      );
    }

    const createdBy =
      auth.session.id === "env-super" ? null : auth.session.id;

    const { data, error } = await auth.admin
      .from("admin_users")
      .insert({
        username,
        password_hash: hashAdminPassword(password),
        display_name: displayName,
        title,
        role,
        active: true,
        created_by: createdBy,
      })
      .select("id, username, display_name, title, role, active, created_at")
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        {
          ok: false,
          message:
            error?.message ??
            "직원 생성에 실패했습니다. 016_admin_users.sql 실행 여부를 확인해 주세요.",
        },
        { status: 500 }
      );
    }

    await writeAdminAudit(auth.admin, auth.session, {
      action: "admin_staff_create",
      entityType: "admin_user",
      entityId: String(data.id),
      detail: { username, role },
    });

    return NextResponse.json({ ok: true, staff: data });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "직원 생성 실패",
      },
      { status: 500 }
    );
  }
}

export const GET = withApiErrorLog(__GET_handler);
export const POST = withApiErrorLog(__POST_handler);
