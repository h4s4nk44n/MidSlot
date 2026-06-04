import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import app from "../index";

const uniq = () => `medi102-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const tokenFor = (userId: string, email: string, role: string): string =>
  jwt.sign({ userId, email, role }, process.env.JWT_SECRET!, { expiresIn: "1h" });

/**
 * MEDI-102 (finish MEDI-74): one Supertest integration test per endpoint group
 * — receptionist, doctor-session, profile-change, admin. Each checks the happy
 * path plus role-based access control.
 */
describe("MEDI-102 — endpoint-group integration tests", () => {
  let adminId: string;
  let adminEmail: string;
  let recId: string;
  let recEmail: string;
  let docUserId: string;
  let docEmail: string;
  let doctorId: string;
  let patientId: string;
  let patientEmail: string;
  const userIds: string[] = [];

  beforeAll(async () => {
    adminEmail = `${uniq()}@admin.test`;
    adminId = (
      await prisma.user.create({
        data: { email: adminEmail, password: "x", name: "M102 Admin", role: "ADMIN" },
      })
    ).id;
    userIds.push(adminId);

    recEmail = `${uniq()}@rec.test`;
    recId = (
      await prisma.user.create({
        data: { email: recEmail, password: "x", name: "M102 Rec", role: "RECEPTIONIST" },
      })
    ).id;
    userIds.push(recId);

    docEmail = `${uniq()}@doc.test`;
    docUserId = (
      await prisma.user.create({
        data: { email: docEmail, password: "x", name: "M102 Doc", role: "DOCTOR" },
      })
    ).id;
    userIds.push(docUserId);
    doctorId = (await prisma.doctor.create({ data: { userId: docUserId, specialization: "GP" } }))
      .id;

    patientEmail = `${uniq()}@pat.test`;
    patientId = (
      await prisma.user.create({
        data: { email: patientEmail, password: "x", name: "M102 Pat", role: "PATIENT" },
      })
    ).id;
    userIds.push(patientId);

    await prisma.receptionistAssignment.create({
      data: { receptionistId: recId, doctorId, assignedByUserId: adminId },
    });
  });

  afterAll(async () => {
    await prisma.receptionistAssignment.deleteMany({ where: { doctorId } });
    await prisma.appointment.deleteMany({ where: { doctorId } });
    await prisma.timeSlot.deleteMany({ where: { doctorId } });
    await prisma.doctor.deleteMany({ where: { id: doctorId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  describe("receptionist", () => {
    it("GET /api/receptionist/doctors returns the assigned doctor; enforces RECEPTIONIST role", async () => {
      const ok = await request(app)
        .get("/api/receptionist/doctors")
        .set("Authorization", `Bearer ${tokenFor(recId, recEmail, "RECEPTIONIST")}`);
      expect(ok.status).toBe(200);
      expect(Array.isArray(ok.body)).toBe(true);
      expect(ok.body.length).toBeGreaterThanOrEqual(1);

      const patientRes = await request(app)
        .get("/api/receptionist/doctors")
        .set("Authorization", `Bearer ${tokenFor(patientId, patientEmail, "PATIENT")}`);
      expect(patientRes.status).toBe(403);

      const anon = await request(app).get("/api/receptionist/doctors");
      expect(anon.status).toBe(401);
    });
  });

  describe("doctor-session", () => {
    let apptId: string;

    beforeAll(async () => {
      const start = new Date(); // today, so the same-day start rule passes
      const slot = await prisma.timeSlot.create({
        data: {
          doctorId,
          date: start,
          startTime: start,
          endTime: new Date(start.getTime() + 30 * 60_000),
          isBooked: true,
        },
      });
      apptId = (
        await prisma.appointment.create({
          data: { patientId, doctorId, timeSlotId: slot.id, status: "BOOKED" },
        })
      ).id;
    });

    it("POST start opens the session and GET session reads it back; enforces DOCTOR role", async () => {
      const docToken = tokenFor(docUserId, docEmail, "DOCTOR");

      const startRes = await request(app)
        .post(`/api/doctor/appointments/${apptId}/start`)
        .set("Authorization", `Bearer ${docToken}`);
      expect(startRes.status).toBe(200);

      const sessionRes = await request(app)
        .get(`/api/doctor/appointments/${apptId}/session`)
        .set("Authorization", `Bearer ${docToken}`);
      expect(sessionRes.status).toBe(200);

      const appt = await prisma.appointment.findUnique({ where: { id: apptId } });
      expect(appt?.startedAt).not.toBeNull();

      const patientRes = await request(app)
        .post(`/api/doctor/appointments/${apptId}/start`)
        .set("Authorization", `Bearer ${tokenFor(patientId, patientEmail, "PATIENT")}`);
      expect(patientRes.status).toBe(403);
    });
  });

  describe("profile-change", () => {
    it("GET + PATCH /api/profile reads and updates the caller's own profile", async () => {
      const token = tokenFor(patientId, patientEmail, "PATIENT");

      const getRes = await request(app).get("/api/profile").set("Authorization", `Bearer ${token}`);
      expect(getRes.status).toBe(200);

      const patchRes = await request(app)
        .patch("/api/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({ city: "Ankara" });
      expect(patchRes.status).toBe(200);

      const dbUser = await prisma.user.findUnique({ where: { id: patientId } });
      expect(dbUser?.city).toBe("Ankara");

      const anon = await request(app).get("/api/profile");
      expect(anon.status).toBe(401);
    });
  });

  describe("admin", () => {
    it("GET /api/admin/users returns a paginated list for an admin; enforces ADMIN role", async () => {
      const ok = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${tokenFor(adminId, adminEmail, "ADMIN")}`);
      expect(ok.status).toBe(200);
      expect(Array.isArray(ok.body.items)).toBe(true);

      const patientRes = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${tokenFor(patientId, patientEmail, "PATIENT")}`);
      expect(patientRes.status).toBe(403);
    });
  });
});
