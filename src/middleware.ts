import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Middleware runs on the edge. Better Auth ships a `getSessionCookie` helper
 * that reads the signed session cookie and returns it only if the signature
 * is valid — i.e. forged cookie names are rejected here.
 *
 * Full DB-backed session verification still happens inside route handlers and
 * server components via `auth.api.getSession` (which also hits the 5-min
 * cookie cache). Middleware is the first line — deny unsigned cookies,
 * redirect anonymous users away from protected routes, redirect authed users
 * away from the login/register pages.
 */

const protectedPaths = ["/dashboard", "/notebook", "/settings"];
const authPaths = ["/login", "/register"];

export const middleware = async (
  request: NextRequest,
): Promise<NextResponse> => {
  const { pathname } = request.nextUrl;

  const sessionCookie = getSessionCookie(request);
  const isAuthenticated = !!sessionCookie;

  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const isAuthPage = authPaths.some((path) => pathname.startsWith(path));
  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
};

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/notebook/:path*",
    "/settings/:path*",
    "/login",
    "/register",
  ],
};
