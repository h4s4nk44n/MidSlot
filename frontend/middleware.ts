import { NextRequest, NextResponse } from "next/server";

/**
 * Edge middleware: auth gate + role verification for protected route groups.
 *
 * HIGH-015: previously checked only the presence of the refresh cookie, which
 * a user could forge locally to view role-shell UIs (admin nav, labels)
 * before the API rejected them. Now we POST /auth/verify from the edge to
 * confirm the cookie is real AND fetch the user's role, then short-circuit
 * mismatched role-prefix navigations to /login. /auth/verify does NOT rotate
 * the refresh-token chain, so it's safe to call on every protected page hit.
 *
 * The real authorization is still enforced by:
 *   - the backend on every API call,
 *   - per-route layout guards (see RouteGuard / role layouts),
 *   - the auth-context hydration on mount.
 */

const PROTECTED_PREFIXES = ["/patient", "/doctor", "/reception", "/admin"] as const;
type ProtectedPrefix = (typeof PROTECTED_PREFIXES)[number];

const REFRESH_COOKIE = "refreshToken";

const ROLE_PREFIX: Record<string, ProtectedPrefix> = {
  PATIENT: "/patient",
  DOCTOR: "/doctor",
  RECEPTIONIST: "/reception",
  ADMIN: "/admin",
};

function backendUrl(req: NextRequest): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  // Allow same-origin /api in dev only (production must set the env).
  if (process.env.NODE_ENV !== "production") {
    return `${req.nextUrl.origin}/api`;
  }
  return null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const matched = PROTECTED_PREFIXES.find(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!matched) return NextResponse.next();

  const hasRefreshCookie = req.cookies.has(REFRESH_COOKIE);
  if (!hasRefreshCookie) {
    return redirectToLogin(req);
  }

  const apiBase = backendUrl(req);
  if (!apiBase) {
    // Misconfig — let the page render so the API can reject the request and
    // produce a real error rather than silently bouncing to /login.
    return NextResponse.next();
  }

  // /auth/verify is non-rotating, so it's safe to call on every navigation.
  let role: string | null = null;
  try {
    const verifyRes = await fetch(`${apiBase}/auth/verify`, {
      method: "POST",
      headers: {
        cookie: `${REFRESH_COOKIE}=${req.cookies.get(REFRESH_COOKIE)?.value ?? ""}`,
      },
    });
    if (!verifyRes.ok) {
      return redirectToLogin(req);
    }
    const data = (await verifyRes.json().catch(() => null)) as
      | { user?: { role?: string } }
      | null;
    role = data?.user?.role ?? null;
  } catch {
    // Network blip / backend down — fall through to the page; the client-side
    // RouteGuard / auth-context will retry and route accordingly.
    return NextResponse.next();
  }

  if (!role) return redirectToLogin(req);

  const expectedPrefix = ROLE_PREFIX[role];
  if (!expectedPrefix || expectedPrefix !== matched) {
    // Authenticated, but wrong role for this prefix. Send them home — never
    // render the role shell of a section they don't belong in.
    return redirectToLogin(req);
  }

  return NextResponse.next();
}

function redirectToLogin(req: NextRequest) {
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("from", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

/**
 * Limit middleware to the four protected groups.
 * Static assets, /login, /register, /, /api are not matched.
 */
export const config = {
  matcher: ["/patient/:path*", "/doctor/:path*", "/reception/:path*", "/admin/:path*"],
};