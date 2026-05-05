import audit, { stripSensitive } from "../utils/audit";
import { AuditAction } from "../types/audit";
import { prisma } from "../lib/prisma";

// Helper: wait for setImmediate to complete
const flushSetImmediate = () => new Promise((resolve) => setImmediate(resolve));

describe("audit helper", () => {
  describe("stripSensitive", () => {
    it("redacts top-level sensitive keys", () => {
      const result = stripSensitive({
        userId: "abc",
        password: "secret123",
        token: "jwt.xxx",
      });
      expect(result).toEqual({
        userId: "abc",
        password: "[REDACTED]",
        token: "[REDACTED]",
      });
    });

    it("redacts nested sensitive keys", () => {
      const result = stripSensitive({
        user: {
          email: "a@b.com",
          password: "secret",
          credentials: { refreshToken: "xyz" },
        },
      });
      expect(result).toEqual({
        user: {
          email: "a@b.com",
          password: "[REDACTED]",
          credentials: { refreshToken: "[REDACTED]" },
        },
      });
    });

    it("redacts within arrays", () => {
      const result = stripSensitive([
        { id: 1, password: "p1" },
        { id: 2, token: "t2" },
      ]);
      expect(result).toEqual([
        { id: 1, password: "[REDACTED]" },
        { id: 2, token: "[REDACTED]" },
      ]);
    });

    it("is case-insensitive on keys", () => {
      const result = stripSensitive({
        Password: "x",
        AccessToken: "y",
        REFRESHTOKEN: "z",
      });
      expect(result).toEqual({
        Password: "[REDACTED]",
        AccessToken: "[REDACTED]",
        REFRESHTOKEN: "[REDACTED]",
      });
    });

    it("leaves primitives unchanged", () => {
      expect(stripSensitive("hello")).toBe("hello");
      expect(stripSensitive(42)).toBe(42);
      expect(stripSensitive(null)).toBe(null);
      expect(stripSensitive(undefined)).toBe(undefined);
    });
  });

  describe("audit.log", () => {
    it("writes a log entry to the database", async () => {
      audit.log({
        action: AuditAction.LOGIN_SUCCESS,
        actorId: null,
        metadata: { email: "test@example.com" },
        ip: "127.0.0.1",
      });

      // Wait for setImmediate to run
      await flushSetImmediate();
      // One more tick — to let the DB write complete
      await new Promise((r) => setTimeout(r, 50));

      const entry = await prisma.auditLog.findFirst({
        where: { action: "login.success", ip: "127.0.0.1" },
        orderBy: { createdAt: "desc" },
      });

      expect(entry).not.toBeNull();
      expect(entry!.metadata).toEqual({ email: "test@example.com" });

      // Cleanup
      await prisma.auditLog.delete({ where: { id: entry!.id } });
    });

    it("strips sensitive fields from metadata before storing", async () => {
      audit.log({
        action: AuditAction.LOGIN_FAILED,
        metadata: {
          email: "leak@test.com",
          password: "should-not-be-stored",
          attempt: { token: "should-also-not-be-stored" },
        },
      });

      await flushSetImmediate();
      await new Promise((r) => setTimeout(r, 50));

      const entry = await prisma.auditLog.findFirst({
        where: { action: "login.failed" },
        orderBy: { createdAt: "desc" },
      });

      expect(entry).not.toBeNull();
      expect(entry!.metadata).toEqual({
        email: "leak@test.com",
        password: "[REDACTED]",
        attempt: { token: "[REDACTED]" },
      });

      await prisma.auditLog.delete({ where: { id: entry!.id } });
    });

    it("does not throw when the DB write fails", async () => {
      // Simulate a failure: pass an invalid action that violates some imagined
      // constraint? Simpler: spy on prisma.auditLog.create and reject.
      const createSpy = jest
        .spyOn(prisma.auditLog, "create")
        .mockRejectedValueOnce(new Error("DB exploded"));

      // Should not throw synchronously
      expect(() => {
        audit.log({ action: AuditAction.LOGIN_SUCCESS });
      }).not.toThrow();

      // Should not throw even after the async work runs
      await flushSetImmediate();
      await new Promise((r) => setTimeout(r, 50));

      expect(createSpy).toHaveBeenCalled();
      createSpy.mockRestore();
    });

    it("returns synchronously (does not block the caller)", () => {
      const start = Date.now();
      audit.log({
        action: AuditAction.APPOINTMENT_BOOK,
        metadata: { slotId: "abc" },
      });
      const elapsed = Date.now() - start;

      // Should be virtually instant — definitely under 5ms even on slow CI
      expect(elapsed).toBeLessThan(5);
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});