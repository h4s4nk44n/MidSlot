import request from "supertest";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";

// Rate limiter'ı DEVRE DIŞI bırak — bu test 6 login isteği atıyor, aksi halde
// rate limiter lockout'tan önce 429 döndürür. env değişkeni app import
// edilmeden ÖNCE set edilmeli.
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
    // İlk 4 başarısız deneme → 401 Unauthorised
    for (let i = 1; i <= 4; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password: "wrong-password" });
      expect(res.status).toBe(401);
    }

    // 5. başarısız deneme → hesap kilitlenir, 423 döner
    const fifthRes = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: "wrong-password" });
    expect(fifthRes.status).toBe(423);

    // 6. istek DOĞRU şifreyle → yine 423, çünkü hesap kilitli
    const sixthRes = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: correctPassword });

    expect(sixthRes.status).toBe(423);
    expect(sixthRes.headers["retry-after"]).toBeDefined();
    expect(Number(sixthRes.headers["retry-after"])).toBeGreaterThan(0);

    // DB state doğrulama — gerçekten kilitlenmiş mi?
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user?.lockedUntil).not.toBeNull();
    expect(user?.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    expect(user?.loginAttempts).toBe(0); // kilitlenince sıfırlanır
  });

  it("does not reveal whether the email exists on wrong credentials", async () => {
    // Yeni bir user oluştur ki ilk testteki kilit bu sonucu etkilemesin
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

    // Var olan kullanıcı, yanlış şifre
    const existingRes = await request(app)
      .post("/api/auth/login")
      .send({ email: freshEmail, password: "wrong-password" });

    // Var olmayan kullanıcı
    const nonExistentRes = await request(app)
      .post("/api/auth/login")
      .send({ email: `nonexistent-${Date.now()}@test.com`, password: "wrong-password" });

    // İkisi de aynı status + aynı mesaj dönmeli — email'in varlığı sızdırılmamalı
    expect(existingRes.status).toBe(401);
    expect(nonExistentRes.status).toBe(401);
    expect(existingRes.body.error).toBe(nonExistentRes.body.error);

    // Cleanup
    await prisma.user.deleteMany({ where: { email: freshEmail } });
  });
});