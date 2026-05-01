import request from "supertest";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";

process.env.DISABLE_RATE_LIMIT = "true";

// eslint-disable-next-line import/first
import app from "../index";

const flushAudit = async () => {
  // setImmediate + DB write için yeterli süre bekle
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setTimeout(r, 100));
};

describe("Audit log emission across flows", () => {
  const testEmail = `audit-flow-${Date.now()}@test.com`;
  const password = "TestPass123";
  let userId: string;

  beforeAll(async () => {
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        password: hashed,
        name: "Audit Flow User",
        role: "PATIENT",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ actorId: userId }, { metadata: { path: ["email"], equals: testEmail } }],
      },
    });
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
    delete process.env.DISABLE_RATE_LIMIT;
  });

  describe("Login flow", () => {
    it("emits login.success on successful login", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password });
      expect(res.status).toBe(200);

      await flushAudit();

      const log = await prisma.auditLog.findFirst({
        where: { action: "login.success", actorId: userId },
        orderBy: { createdAt: "desc" },
      });

      expect(log).not.toBeNull();
      expect(log!.targetType).toBe("User");
      expect(log!.targetId).toBe(userId);
      expect((log!.metadata as Record<string, unknown>).email).toBe(testEmail);
    });

    it("emits login.failed with reason=bad_password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password: "wrong-pw" });
      expect(res.status).toBe(401);

      await flushAudit();

      const log = await prisma.auditLog.findFirst({
        where: { action: "login.failed", actorId: userId },
        orderBy: { createdAt: "desc" },
      });

      expect(log).not.toBeNull();
      expect((log!.metadata as Record<string, unknown>).reason).toBe("bad_password");
    });

    it("emits login.failed with reason=user_not_found for unknown emails", async () => {
      const ghostEmail = `ghost-${Date.now()}@test.com`;
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: ghostEmail, password: "any-pw" });
      expect(res.status).toBe(401);

      await flushAudit();

      const log = await prisma.auditLog.findFirst({
        where: {
          action: "login.failed",
          metadata: { path: ["email"], equals: ghostEmail },
        },
      });

      expect(log).not.toBeNull();
      expect(log!.actorId).toBeNull();
      expect((log!.metadata as Record<string, unknown>).reason).toBe("user_not_found");
    });
  });

  describe("Sensitive data redaction", () => {
    it("never stores raw passwords in audit metadata", async () => {
      const uniquePassword = `unique-secret-${Date.now()}`;
      await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password: uniquePassword });

      await flushAudit();

      // Hiçbir audit log'da bu password görünmemeli
      const allLogs = await prisma.auditLog.findMany({
        where: { actorId: userId },
      });

      for (const log of allLogs) {
        const serialized = JSON.stringify(log.metadata);
        expect(serialized).not.toContain(uniquePassword);
      }
    });
  });
});