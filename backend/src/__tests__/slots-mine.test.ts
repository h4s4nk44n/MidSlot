import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import app from "../index";

const uniq = () => `slotsmine-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const tokenFor = (userId: string, email: string, role: string) =>
  jwt.sign({ userId, email, role }, process.env.JWT_SECRET!, { expiresIn: "1h" });

const HOUR = 60 * 60 * 1000;

/**
 * Regression test for the availability bug: GET /slots (public, no auth) returns
 * EVERY doctor's free slots, so the doctor Availability page was showing other
 * doctors' openings. GET /slots/mine is JWT-scoped — a doctor only ever sees
 * their own slots.
 */
describe("GET /api/slots/mine — scoped to the authenticated doctor", () => {
  let docAUserId: string;
  let docAEmail: string;
  let docAId: string;
  let docBId: string;
  const userIds: string[] = [];
  const doctorIds: string[] = [];

  beforeAll(async () => {
    const ua = await prisma.user.create({
      data: { email: `${uniq()}@a.test`, password: "x", name: "Doc A", role: "DOCTOR" },
    });
    docAUserId = ua.id;
    docAEmail = ua.email;
    userIds.push(ua.id);
    const da = await prisma.doctor.create({
      data: { userId: ua.id, specialization: "Cardiology" },
    });
    docAId = da.id;
    doctorIds.push(da.id);

    const ub = await prisma.user.create({
      data: { email: `${uniq()}@b.test`, password: "x", name: "Doc B", role: "DOCTOR" },
    });
    userIds.push(ub.id);
    const db = await prisma.doctor.create({
      data: { userId: ub.id, specialization: "Dermatology" },
    });
    docBId = db.id;
    doctorIds.push(db.id);

    const base = new Date(Date.now() + 7 * 24 * HOUR);
    // 3 slots for A, 2 for B — at distinct times.
    for (let i = 0; i < 3; i++) {
      const s = new Date(base.getTime() + i * HOUR);
      await prisma.timeSlot.create({
        data: {
          doctorId: docAId,
          date: s,
          startTime: s,
          endTime: new Date(s.getTime() + HOUR / 2),
          isBooked: false,
        },
      });
    }
    for (let i = 0; i < 2; i++) {
      const s = new Date(base.getTime() + (i + 5) * HOUR);
      await prisma.timeSlot.create({
        data: {
          doctorId: docBId,
          date: s,
          startTime: s,
          endTime: new Date(s.getTime() + HOUR / 2),
          isBooked: false,
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.timeSlot.deleteMany({ where: { doctorId: { in: doctorIds } } });
    await prisma.doctor.deleteMany({ where: { id: { in: doctorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("returns only the authenticated doctor's slots, not other doctors'", async () => {
    const res = await request(app)
      .get("/api/slots/mine")
      .set("Authorization", `Bearer ${tokenFor(docAUserId, docAEmail, "DOCTOR")}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Doctor A created exactly 3 slots; doctor B's 2 must NOT leak in.
    expect(res.body.length).toBe(3);
    expect([...new Set(res.body.map((s: { doctorId: string }) => s.doctorId))]).toEqual([docAId]);
  });

  it("rejects non-doctor roles", async () => {
    const patient = await prisma.user.create({
      data: { email: `${uniq()}@p.test`, password: "x", name: "Pat", role: "PATIENT" },
    });
    userIds.push(patient.id);

    const res = await request(app)
      .get("/api/slots/mine")
      .set("Authorization", `Bearer ${tokenFor(patient.id, patient.email, "PATIENT")}`);

    expect(res.status).toBe(403);
  });
});
