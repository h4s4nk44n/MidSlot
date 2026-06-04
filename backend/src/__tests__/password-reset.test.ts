import request from "supertest";
import * as bcrypt from "bcrypt";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import app from "../index";
import {
  setEmailProvider,
  resolveEmailProvider,
  type EmailMessage,
  type EmailProvider,
} from "../lib/email";

const uniq = () => `medi100-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

class CapturingEmailProvider implements EmailProvider {
  readonly name = "capture";
  sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

function extractToken(message: EmailMessage): string | null {
  const match = `${message.text ?? ""}${message.html}`.match(/token=([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

describe("MEDI-100 — forgot/reset password", () => {
  const fake = new CapturingEmailProvider();
  const oldPassword = "OldPass123";
  const newPassword = "NewPass456";
  let email: string;
  let userId: string;

  beforeAll(async () => {
    setEmailProvider(fake);
    email = `${uniq()}@reset.test`;
    const user = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(oldPassword, 12),
        name: "Reset User",
        role: "PATIENT",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    setEmailProvider(resolveEmailProvider());
    await prisma.passwordResetToken.deleteMany({ where: { userId } });
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("happy path: forgot → emailed token → reset → log in with the new password", async () => {
    const before = fake.sent.length;
    const forgotRes = await request(app).post("/api/auth/forgot-password").send({ email });
    expect(forgotRes.status).toBe(200);
    expect(fake.sent.length).toBe(before + 1);

    const token = extractToken(fake.sent[fake.sent.length - 1]);
    expect(token).toBeTruthy();

    const resetRes = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: newPassword });
    expect(resetRes.status).toBe(200);

    // The new password works...
    const loginNew = await request(app)
      .post("/api/auth/login")
      .send({ email, password: newPassword });
    expect(loginNew.status).toBe(200);

    // ...and the old one no longer does.
    const loginOld = await request(app)
      .post("/api/auth/login")
      .send({ email, password: oldPassword });
    expect(loginOld.status).toBe(401);
  });

  it("rejects a reused (already-used) token", async () => {
    await request(app).post("/api/auth/forgot-password").send({ email });
    const token = extractToken(fake.sent[fake.sent.length - 1]);

    const first = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "Another123" });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "YetMore123" });
    expect(second.status).toBe(400);
  });

  it("rejects an expired token", async () => {
    const raw = crypto.randomBytes(48).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
    await prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: raw, password: "Expired123" });
    expect(res.status).toBe(400);
  });

  it("does not reveal whether an email is registered (always 200, no email for unknown)", async () => {
    const before = fake.sent.length;
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: `${uniq()}@nobody.test` });
    expect(res.status).toBe(200);
    expect(fake.sent.length).toBe(before);
  });
});
