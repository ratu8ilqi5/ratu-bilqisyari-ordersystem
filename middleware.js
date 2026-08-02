import { NextResponse } from "next/server";

export function middleware(request) {
  const cookie = request.cookies.get("admin_session");
  if (cookie?.value === "ok") return NextResponse.next();

  const loginUrl = new URL("/admin-login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
