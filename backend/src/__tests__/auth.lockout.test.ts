import request from "supertest";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";

// DISABLE the rate limiter — this test fires 6 login requests, otherwise
// the rate limiter would return 429 before the lockout kicks in. The env
// variable must be set BEFORE the app is imported.
process.env.DISABLE_RATE_LIMIT = "true";

// eslint-disable-next-line import/first
import app from "../index";

describe("Account lockout after repeated failed logins", () => {
  const testEmail = `lockout-${Date.now()}@test.com`;
  const correctPassword = "CorrectPass123";

  beforeAll(async () => {
    const hashed = await bcrypt.hash(correctPassword, 10);
    await prisma.user.create({
      data: {
        email: testEmail,
        password: hashed,
        name: "Lockout Test User",
        role: "PATIENT",
      },
    });
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { user: { email: testEmail } } });
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await prisma.$disconnect();
    delete process.env.DISABLE_RATE_LIMIT;
  });

  it("locks the account after 5 failed attempts and rejects the 6th even with correct password", async () => {
    // First 4 failed attempts → 401 Unauthorised
    for (let i = 1; i <= 4; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password: "wrong-password" });
      expect(res.status).toBe(401);
    }

    // 5th failed attempt → account is locked, returns 423
    const fifthRes = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: "wrong-password" });
    expect(fifthRes.status).toBe(423);

    // 6th request with the CORRECT password → still 423, because the account is locked
    const sixthRes = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: correctPassword });

    expect(sixthRes.status).toBe(423);
    expect(sixthRes.headers["retry-after"]).toBeDefined();
    expect(Number(sixthRes.headers["retry-after"])).toBeGreaterThan(0);

    // DB state verification — is it actually locked?
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user?.lockedUntil).not.toBeNull();
    expect(user?.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    // HIGH-001: loginAttempts is preserved on lockout (only reset on a
    // successful login). Resetting to 0 here would give repeat offenders a
    // fresh 5-attempt window after every lockout cycle.
    expect(user?.loginAttempts).toBe(5);
  });

  it("does not reveal whether the email exists on wrong credentials", async () => {
    // Create a new user so the lock from the first test doesn't affect this result
    const freshEmail = `fresh-${Date.now()}@test.com`;
    const hashed = await bcrypt.hash("SomePass123", 10);
    await prisma.user.create({
      data: {
        email: freshEmail,
        password: hashed,
        name: "Fresh User",
        role: "PATIENT",
      },
    });

    // Existing user, wrong password
    const existingRes = await request(app)
      .post("/api/auth/login")
      .send({ email: freshEmail, password: "wrong-password" });

    // Non-existent user
    const nonExistentRes = await request(app)
      .post("/api/auth/login")
      .send({ email: `nonexistent-${Date.now()}@test.com`, password: "wrong-password" });

    // Both must return the same status + the same message — the existence of the email must not leak
    expect(existingRes.status).toBe(401);
    expect(nonExistentRes.status).toBe(401);
    expect(existingRes.body.error).toBe(nonExistentRes.body.error);

    // Cleanup
    await prisma.user.deleteMany({ where: { email: freshEmail } });
  });
});