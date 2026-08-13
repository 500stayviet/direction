import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminAuth";
import { withApiErrorLog } from "@/lib/appErrorLog";
import {
  adminRemoveWorkspaceMember,
  listWorkspaceMembers,
} from "@/lib/workspaceServer";

type Params = { params: Promise<{ id: string }> };

async function __GET_handler(_request: Request, { params }: Params) {
  const auth = await requireAdminSession(_request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status }
    );
  }

  const { id } = await params;
  const workspaceId = (id ?? "").trim();
  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, message: "팀 id가 필요합니다." },
      { status: 400 }
    );
  }

  const { data: ws, error } = await auth.admin
    .from("workspaces")
    .select("id, name, share_code, created_by, created_at")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error || !ws) {
    return NextResponse.json(
      { ok: false, message: error?.message ?? "팀을 찾을 수 없습니다." },
      { status: error ? 500 : 404 }
    );
  }

  const members = await listWorkspaceMembers(auth.admin, workspaceId);
  return NextResponse.json({
    ok: true,
    team: {
      id: ws.id,
      name: ws.name,
      createdAt: ws.created_at,
      memberCount: members.length,
      members: members.map((m) => ({
        userId: m.userId,
        role: m.role,
        shopName: m.shopName,
        name: m.name,
        username: m.username,
      })),
    },
  });
}

async function __POST_handler(request: Request, { params }: Params) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status }
    );
  }
  const { id } = await params;
  const workspaceId = (id ?? "").trim();
  try {
    const body = (await request.json()) as {
      action?: string;
      userId?: string;
    };
    if (body.action !== "remove-member") {
      return NextResponse.json(
        { ok: false, message: "지원하지 않는 동작입니다." },
        { status: 400 }
      );
    }
    const userId = (body.userId ?? "").trim();
    if (!workspaceId || !userId) {
      return NextResponse.json(
        { ok: false, message: "팀·대상 계정이 필요합니다." },
        { status: 400 }
      );
    }

    const result = await adminRemoveWorkspaceMember(
      auth.admin,
      workspaceId,
      userId,
      `${auth.session.title}:${auth.session.displayName}`
    );
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: result.message },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "팀원 나가기 실패",
      },
      { status: 500 }
    );
  }
}

export const GET = withApiErrorLog(__GET_handler);
export const POST = withApiErrorLog(__POST_handler);
