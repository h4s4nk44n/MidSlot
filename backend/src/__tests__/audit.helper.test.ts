import audit, { stripSensitive } from "../utils/audit";
import { AuditAction } from "../types/audit";
import { prisma } from "../lib/prisma";
import { Prisma } from "../generated/prisma";

// Helper: wait for setImmediate to complete
const flushSetImmediate = () => new Promise((resolve) => setImmediate(resolve));

// audit.log writes via setImmediate (fire-and-forget). A fixed sleep is flaky
// under CI load — the async DB write can land later than the wait — so poll
// until the row appears (or the timeout elapses) instead.
async function waitForAuditEntry(where: Prisma.AuditLogWhereInput, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  let entry = await prisma.auditLog.findFirst({ where, orderBy: { createdAt: "desc" } });
  while (!entry && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 25));
    await flushSetImmediate();
    entry = await prisma.auditLog.findFirst({ where, orderBy: { createdAt: "desc" } });
  }
  return entry;
}

// A unique-per-call marker (stored in the ip field) so the poller matches the
// row THIS test wrote, not a stale login.success/login.failed entry left in the
// shared DB by another test.
let auditMarkerSeq = 0;
const auditMarker = () => `medi-audit-${Date.now()}-${auditMarkerSeq++}`;

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
      const ip = auditMarker();
      audit.log({
        action: AuditAction.LOGIN_SUCCESS,
        actorId: null,
        metadata: { email: "test@example.com" },
        ip,
      });

      const entry = await waitForAuditEntry({ action: "login.success", ip });

      expect(entry).not.toBeNull();
      expect(entry!.metadata).toEqual({ email: "test@example.com" });

      // Cleanup
      await prisma.auditLog.delete({ where: { id: entry!.id } });
    });

    it("strips sensitive fields from metadata before storing", async () => {
      const ip = auditMarker();
      audit.log({
        action: AuditAction.LOGIN_FAILED,
        metadata: {
          email: "leak@test.com",
          password: "should-not-be-stored",
          attempt: { token: "should-also-not-be-stored" },
        },
        ip,
      });

      const entry = await waitForAuditEntry({ action: "login.failed", ip });

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

    it("returns synchronously (does not block the caller)", async () => {
      // audit.log schedules the DB insert on setImmediate, so create() has not
      // been called by the time it returns — and runs on the next tick. This is
      // a deterministic check, unlike a wall-clock threshold (which flakes under
      // CI load).
      const spy = jest.spyOn(prisma.auditLog, "create").mockResolvedValue({} as never);

      audit.log({
        action: AuditAction.APPOINTMENT_BOOK,
        metadata: { slotId: "abc" },
      });
      expect(spy).not.toHaveBeenCalled();

      await flushSetImmediate();
      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
