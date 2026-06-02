import { NextRequest, NextResponse } from "next/server";

const AUTH_ACCESS_COOKIE = "architoken_access";
const AUTH_SESSION_COOKIE = "architoken_session";

export function proxy(request: NextRequest) {
  if (hasAuthCookie(request)) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/auth";
  redirectUrl.search = "";
  redirectUrl.searchParams.set("mode", "register");
  redirectUrl.searchParams.set(
    "returnTo",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(redirectUrl);
}

function hasAuthCookie(request: NextRequest): boolean {
  return Boolean(
    request.cookies.get(AUTH_ACCESS_COOKIE)?.value ||
    request.cookies.get(AUTH_SESSION_COOKIE)?.value,
  );
}

export const config = {
  matcher: ["/app/:path*", "/home/:path*", "/project/:path*", "/studio/:path*"],
};
