import crypto from "crypto";
import { Response } from "express";

export const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateRawRefreshToken(): string {
  return crypto.randomBytes(64).toString("base64url");
}

export function hashRefreshToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

// HIGH-013: SameSite=Strict and force secure in production. In production
// the cookie MUST be Secure regardless of the legacy COOKIE_SECURE flag.
// In development we keep secure=false (and SameSite=Lax) so the cookie still
// flows over plain HTTP localhost.
function refreshCookieFlags(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "strict" | "lax";
  path: string;
} {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd || process.env.COOKIE_SECURE === "true",
    sameSite: isProd ? "strict" : "lax",
    path: "/",
  };
}

export function setRefreshCookie(res: Response, rawToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    ...refreshCookieFlags(),
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieFlags());
}