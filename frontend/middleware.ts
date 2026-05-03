import { NextRequest, NextResponse } from "next/server";

/**
 * Edge middleware: cheap auth gate for protected route groups.
 *
 * Why "cheap": access tokens live in memory (not cookies), so the edge can't
 * verify them. Refresh tokens DO sit in an httpOnly cookie. We use the
 * presence of that cookie as a "this might be a logged-in user" signal —
 * enough to bounce bots and stale tabs straight to /login. The real
 * authorization (token validity, role checks) is enforced by:
 *   - the backend on every API call,
 *   - per-route layout guards (see RouteGuard / role layouts),
 *   - the auth-context hydration on mount.
 *
 * If the cookie is invalid or expired, the auth-context will catch that on
 * /auth/refresh failure and redirect to /login itself.
 */

const PROTECTED_PREFIXES = ["/patient", "/doctor", "/reception", "/admin"];

const REFRESH_COOKIE = "refreshToken";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!isProtected) return NextResponse.next();

  const hasRefreshCookie = req.cookies.has(REFRESH_COOKIE);
  if (hasRefreshCookie) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  // Preserve where they were trying to go so we can bounce them back later.
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

/**
 * Limit middleware to the four protected groups.
 * Static assets, /login, /register, /, /api are not matched.
 */
export const config = {
  matcher: ["/patient/:path*", "/doctor/:path*", "/reception/:path*", "/admin/:path*"],
};