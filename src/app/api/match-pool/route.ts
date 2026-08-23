import { NextResponse } from "next/server";
import { withApiErrorLog } from "@/lib/appErrorLog";
import { getAuthUserFromToken, getBearerToken } from "@/lib/serverAuth";
import { applyMatchPoolRedaction } from "@/lib/matchPoolRedaction";
import {
  loadMatchPoolCustomersForUser,
  loadMatchPoolPropertiesForUser,
} from "@/lib/serverWorkspaceEntities";

/** 매칭 풀 — 워크스페이스 전체(팀원 비공유 포함). RLS 우회는 서버에서만 */
async function __GET_handler(request: Request) {
  const auth = await getAuthUserFromToken(getBearerToken(request));
  if (!auth) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const [rawCustomers, rawProperties] = await Promise.all([
      loadMatchPoolCustomersForUser(auth.admin, auth.user.id),
      loadMatchPoolPropertiesForUser(auth.admin, auth.user.id),
    ]);
    const { customers, properties } = applyMatchPoolRedaction({
      customers: rawCustomers,
      properties: rawProperties,
      viewerUserId: auth.user.id,
    });
    return NextResponse.json({ ok: true, customers, properties });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message:
          e instanceof Error
            ? e.message
            : "매칭 풀을 불러오지 못했습니다.",
      },
      { status: 500 }
    );
  }
}

export const GET = withApiErrorLog(__GET_handler);
