import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/signup", "/forgot-password"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasAuthCookie = request.cookies.has("refresh_token");

  if (publicPaths.some((path) => pathname.startsWith(path))) {
    if (hasAuthCookie) {
      return NextResponse.redirect(new URL("/agents", request.url));
    }
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/agents") ||
    pathname.startsWith("/executions") ||
    pathname.startsWith("/integrations") ||
    pathname.startsWith("/knowledge") ||
    pathname.startsWith("/templates") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/settings")
  ) {
    if (!hasAuthCookie) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
