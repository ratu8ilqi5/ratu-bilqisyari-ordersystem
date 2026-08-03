import { NextResponse } from "next/server";

export async function POST(request) {
  const { password } = await request.json();

  if (password && password === process.env.ADMIN_PASSWORD) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("admin_session", "ok", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 hari
    });
    return res;
  }

  return NextResponse.json({ ok: false, error: "Password salah" }, { status: 401 });
}
