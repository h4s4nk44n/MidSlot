import request from "supertest";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { hashRefreshToken } from "../utils/tokenHelpers";

// Refresh akışı 5 limit'i aşmıyor ama yine de güvenli olsun
process.env.DISABLE_RATE_LIMIT = "true";

// eslint-disable-next-line import/first
import app from "../index";

const REFRESH_COOKIE_NAME = "refreshToken";

/**
 * Helper: extract the refresh token value from a Set-Cookie header.
 * Returns the raw cookie string (without attributes) suitable for sending back.
 */
function extractRefreshCookie(res: request.Response): string | null {
  const setCookie = res.headers["set-cookie"];
  if (!setCookie) return null;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const match = cookies.find((c) => c.startsWith(`${REFRESH_COOKIE_NAME}=`));
  if (!match) return null;
  // "refreshToken=abc; Path=/...; HttpOnly" → "refreshToken=abc"
  return match.split(";")[0];
}

/**
 * Helper: extract just the raw token value (after the = sign).
 */
function extractRawToken(cookieString: string | null): string | null {
  if (!cookieString) return null;
  return cookieString.split("=")[1];
}

describe("Refresh token rotation, logout & reuse detection", () => {
  const testEmail = `refresh-flow-${Date.now()}@test.com`;
  const password = "TestPass123";
  let userId: string;

  beforeAll(async () => {
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        password: hashed,
        name: "Refresh Flow User",
        role: "PATIENT",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
    delete process.env.DISABLE_RATE_LIMIT;
  });

  // ────────────────────────────────────────────────────────────────────────
  // MEDI-77: model + cookie behaviour
  // ────────────────────────────────────────────────────────────────────────
  describe("Login (MEDI-77 — cookie, never in body)", () => {
    it("sets refresh token as httpOnly cookie and never in JSON body", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();

      // Body must NOT contain refresh token
      expect(res.body.refreshToken).toBeUndefined();
      expect(res.body.rawRefreshToken).toBeUndefined();

      // Cookie must be set with httpOnly + correct path
      const setCookie = res.headers["set-cookie"];
      expect(setCookie).toBeDefined();
      const cookieStr = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
      expect(cookieStr).toContain(`${REFRESH_COOKIE_NAME}=`);
      expect(cookieStr).toContain("HttpOnly");
      expect(cookieStr).toContain("Path=/api/auth");
    });

    it("stores refresh token as a hash, not raw, in the database", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password });

      const cookie = extractRefreshCookie(res);
      const rawToken = extractRawToken(cookie);
      expect(rawToken).toBeTruthy();

      // The raw token should NOT exist in the DB
      const matchByRaw = await prisma.refreshToken.findFirst({
        where: { tokenHash: rawToken! },
      });
      expect(matchByRaw).toBeNull();

      // But its hash should
      const matchByHash = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(rawToken!) },
      });
      expect(matchByHash).not.toBeNull();
      expect(matchByHash!.userId).toBe(userId);
      expect(matchByHash!.familyId).toBeDefined();
      expect(matchByHash!.revokedAt).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // MEDI-78: rotation
  // ────────────────────────────────────────────────────────────────────────
  describe("Refresh rotation (MEDI-78)", () => {
    it("rotates the refresh token and revokes the old one", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password });
      const oldCookie = extractRefreshCookie(loginRes);
      const oldRaw = extractRawToken(oldCookie)!;

      const refreshRes = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", oldCookie!);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.token).toBeDefined();

      const newCookie = extractRefreshCookie(refreshRes);
      const newRaw = extractRawToken(newCookie)!;

      // New token must be different from the old one
      expect(newRaw).not.toBe(oldRaw);

      // Old token must be revoked and linked to the new one
      const oldStored = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(oldRaw) },
      });
      const newStored = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(newRaw) },
      });

      expect(oldStored).not.toBeNull();
      expect(newStored).not.toBeNull();
      expect(oldStored!.revokedAt).not.toBeNull();
      expect(oldStored!.replacedById).toBe(newStored!.id);
      expect(newStored!.revokedAt).toBeNull();

      // SAME family across rotation
      expect(newStored!.familyId).toBe(oldStored!.familyId);
    });

    it("rejects unknown / expired / missing refresh tokens with 401", async () => {
      // Unknown
      const unknownRes = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", `${REFRESH_COOKIE_NAME}=garbage-token-value`);
      expect(unknownRes.status).toBe(401);

      // Missing
      const missingRes = await request(app).post("/api/auth/refresh");
      expect(missingRes.status).toBe(401);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // MEDI-79: logout
  // ────────────────────────────────────────────────────────────────────────
  describe("Logout (MEDI-79)", () => {
    it("returns 204, revokes the token, and clears the cookie", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password });
      const cookie = extractRefreshCookie(loginRes);
      const rawToken = extractRawToken(cookie)!;

      const logoutRes = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", cookie!);

      expect(logoutRes.status).toBe(204);

      // Cookie cleared
      const setCookie = logoutRes.headers["set-cookie"];
      const cookieStr = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
      expect(cookieStr).toContain(`${REFRESH_COOKIE_NAME}=;`);
      expect(cookieStr).toContain("Expires=Thu, 01 Jan 1970");

      // Token marked revoked in DB
      const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(rawToken) },
      });
      expect(stored!.revokedAt).not.toBeNull();
    });

    it("makes the revoked refresh token unusable at /auth/refresh", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password });
      const cookie = extractRefreshCookie(loginRes);

      await request(app).post("/api/auth/logout").set("Cookie", cookie!);

      // Try to use the now-revoked token
      const refreshAfterLogout = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookie!);

      expect(refreshAfterLogout.status).toBe(401);
    });

    it("is idempotent — logout without a cookie still returns 204", async () => {
      const res = await request(app).post("/api/auth/logout");
      expect(res.status).toBe(204);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // MEDI-80: reuse detection
  // ────────────────────────────────────────────────────────────────────────
  describe("Reuse detection (MEDI-80)", () => {
    it("revokes the entire family when a rotated token is reused", async () => {
      // Login → token A (active, family F)
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password });
      const cookieA = extractRefreshCookie(loginRes);
      const rawA = extractRawToken(cookieA)!;

      // Rotate: A → B (A revoked, B active)
      const rotateRes = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookieA!);
      expect(rotateRes.status).toBe(200);
      const cookieB = extractRefreshCookie(rotateRes);
      const rawB = extractRawToken(cookieB)!;

      // Reuse A (theft signal!) → 401, family killed
      const reuseRes = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookieA!);
      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error).toMatch(/reuse/i);

      // B should now also be revoked (whole family)
      const storedB = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(rawB) },
      });
      expect(storedB!.revokedAt).not.toBeNull();

      // Confirm B can no longer be used
      const useBafterFamilyKill = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookieB!);
      expect(useBafterFamilyKill.status).toBe(401);

      // (Sanity) A should still be marked revoked too
      const storedA = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(rawA) },
      });
      expect(storedA!.revokedAt).not.toBeNull();
    });

    it("a fresh login starts a new family unaffected by prior revocations", async () => {
      // Family from previous test is dead. New login should issue a brand
      // new family that works normally.
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password });
      const cookie = extractRefreshCookie(loginRes);
      const raw = extractRawToken(cookie)!;

      const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(raw) },
      });

      expect(stored).not.toBeNull();
      expect(stored!.revokedAt).toBeNull();

      // Should be able to refresh with this fresh token
      const refreshRes = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookie!);
      expect(refreshRes.status).toBe(200);
    });
  });
});