import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/signup", "/forgot-password"];

const protectedPaths = [
  "/agents",
  "/executions",
  "/integrations",
  "/knowledge",
  "/templates",
  "/analytics",
  "/settings",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for auth indicator cookie (set client-side after login)
  const isLoggedIn = request.cookies.has("agentflow_auth");

  // Public paths: if logged in, redirect to dashboard
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/agents", request.url));
    }
    return NextResponse.next();
  }

  // Protected paths: if not logged in, redirect to login
  if (protectedPaths.some((path) => pathname.startsWith(path))) {
    if (!isLoggedIn) {
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
