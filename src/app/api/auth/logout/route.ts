import { NextResponse } from "next/server";

/** 서버에서 로그인 쿠키를 확실히 만료 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("realty_app_user_v1", "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
