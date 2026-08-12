import { NextResponse } from "next/server";
import {
  requireAdminSession,
  requireSuper,
} from "@/lib/adminAuth";

const TEST_OWNER_NOTE = "관리자 소프트삭제 테스트";

/** 관리자: 소프트삭제 목록·복원 테스트용 행 생성 (슈퍼만) */
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
    const body = (await request.json().catch(() => ({}))) as {
      toUsername?: string;
    };
    const toUsername = (body.toUsername ?? "").trim().toLowerCase();

    let profile: {
      id: string;
      username: string;
      display_name: string;
      shop_name: string;
    } | null = null;

    if (toUsername) {
      const { data } = await auth.admin
        .from("profiles")
        .select("id, username, display_name, shop_name")
        .eq("username", toUsername)
        .maybeSingle();
      profile = data;
      if (!profile) {
        return NextResponse.json(
          { ok: false, message: `아이디 '${toUsername}' 계정을 찾을 수 없습니다.` },
          { status: 404 }
        );
      }
    } else {
      const { data } = await auth.admin
        .from("profiles")
        .select("id, username, display_name, shop_name")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      profile = data;
      if (!profile) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "가입된 앱 계정이 없습니다. 먼저 일반 회원가입 후 다시 시도해 주세요.",
          },
          { status: 400 }
        );
      }
    }

    const userId = profile.id;
    const ownerName =
      String(profile.display_name || "").trim() ||
      String(profile.shop_name || "").trim() ||
      profile.username;
    const now = new Date();
    const nowIso = now.toISOString();
    const daysAgo = (n: number) =>
      new Date(now.getTime() - n * 86400000).toISOString();

    const customerId = "admin_test_soft_cust";
    const propertyId = "admin_test_soft_prop";
    const scheduleId = "admin_test_soft_sch";
    const oldCustomerId = "admin_test_soft_cust_old";

    const customerPayload = {
      id: customerId,
      name: "[테스트] 소프트삭제 고객",
      phone: "010-9999-0001",
      propertyType: "원룸",
      createdBy: userId,
      createdByName: ownerName,
      note: TEST_OWNER_NOTE,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const propertyPayload = {
      id: propertyId,
      address: "서울 테스트구 테스트로 1",
      roomNo: "1204",
      propertyType: "원룸",
      createdBy: userId,
      createdByName: ownerName,
      note: TEST_OWNER_NOTE,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const schedulePayload = {
      id: scheduleId,
      guestName: "[테스트] 소프트삭제 네비",
      customerId: "",
      properties: [],
      createdBy: userId,
      createdByName: ownerName,
      note: TEST_OWNER_NOTE,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const oldCustomerPayload = {
      ...customerPayload,
      id: oldCustomerId,
      name: "[테스트] 30일+ 삭제 고객",
      phone: "010-9999-0031",
      createdAt: daysAgo(40),
      updatedAt: daysAgo(35),
    };

    const baseRow = {
      user_id: userId,
      workspace_id: null,
      created_by: userId,
      created_by_name: ownerName,
      workspace_shared: false,
      deleted_by: userId,
    };

    const upserts: {
      table: "customers" | "listed_properties" | "schedules";
      id: string;
      payload: Record<string, unknown>;
      deletedAt: string;
      createdAt: string;
    }[] = [
      {
        table: "customers",
        id: customerId,
        payload: customerPayload,
        deletedAt: nowIso,
        createdAt: nowIso,
      },
      {
        table: "listed_properties",
        id: propertyId,
        payload: propertyPayload,
        deletedAt: nowIso,
        createdAt: nowIso,
      },
      {
        table: "schedules",
        id: scheduleId,
        payload: schedulePayload,
        deletedAt: nowIso,
        createdAt: nowIso,
      },
      {
        table: "customers",
        id: oldCustomerId,
        payload: oldCustomerPayload,
        deletedAt: daysAgo(35),
        createdAt: daysAgo(40),
      },
    ];

    for (const item of upserts) {
      const { error } = await auth.admin.from(item.table).upsert(
        {
          ...baseRow,
          id: item.id,
          payload: item.payload,
          created_at: item.createdAt,
          updated_at: item.deletedAt,
          deleted_at: item.deletedAt,
        },
        { onConflict: "user_id,id" }
      );
      if (error) {
        return NextResponse.json(
          {
            ok: false,
            message: `${item.table} 테스트 생성 실패: ${error.message}`,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      owner: {
        userId,
        username: profile.username,
        name: ownerName,
      },
      created: [
        { type: "customers", id: customerId, label: "최근 삭제 고객" },
        { type: "properties", id: propertyId, label: "최근 삭제 매물(호실 1204)" },
        { type: "schedules", id: scheduleId, label: "최근 삭제 네비" },
        {
          type: "customers",
          id: oldCustomerId,
          label: "30일+ 삭제 고객",
        },
      ],
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "테스트 생성 실패",
      },
      { status: 500 }
    );
  }
}
