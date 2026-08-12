import { NextResponse } from "next/server";
import { getAuthUserFromToken, getBearerToken } from "@/lib/serverAuth";
import { buildWorkspaceInfo } from "@/lib/workspaceServer";
import { withApiErrorLog } from "@/lib/appErrorLog";

async function __GET_handler(request: Request) {
  try {
    const auth = await getAuthUserFromToken(getBearerToken(request));
    if (!auth) {
      return NextResponse.json(
        { ok: false, message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }
    const workspace = await buildWorkspaceInfo(auth.admin, auth.user.id);
    return NextResponse.json({ ok: true, workspace });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message:
          e instanceof Error ? e.message : "업장 정보를 불러오지 못했습니다.",
      },
      { status: 500 }
    );
  }
}

export const GET = withApiErrorLog(__GET_handler);
