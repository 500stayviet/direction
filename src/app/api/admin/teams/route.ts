import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminAuth";
import { listWorkspaceMembers } from "@/lib/workspaceServer";
import { withApiErrorLog } from "@/lib/appErrorLog";

async function __GET_handler(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status }
    );
  }

  const url = new URL(request.url);
  const rawQ = (url.searchParams.get("q") ?? "").trim();
  const q = rawQ.toLowerCase();
  const pageLimit = 5;

  try {
    const { data: workspaces, error } = await auth.admin
      .from("workspaces")
      .select("id, name, share_code, created_by, created_at")
      .order("created_at", { ascending: false })
      .limit(q ? 120 : 40);
    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    const teams = [];
    for (const w of workspaces ?? []) {
      const members = await listWorkspaceMembers(auth.admin, String(w.id));
      if (members.length < 2) continue;
      const hay = [
        String(w.name ?? ""),
        ...members.map(
          (m) => `${m.shopName} ${m.name} ${m.username} ${m.phone}`
        ),
      ]
        .join(" ")
        .toLowerCase();
      if (q && !hay.includes(q)) continue;
      teams.push({
        id: w.id,
        name: w.name,
        createdAt: w.created_at,
        memberCount: members.length,
        members: members.map((m) => ({
          userId: m.userId,
          role: m.role,
          shopName: m.shopName,
          name: m.name,
          username: m.username,
        })),
      });
      if (teams.length >= pageLimit) break;
    }

    return NextResponse.json({
      ok: true,
      q: rawQ,
      limit: pageLimit,
      teams,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "팀 조회 실패",
      },
      { status: 500 }
    );
  }
}

export const GET = withApiErrorLog(__GET_handler);
