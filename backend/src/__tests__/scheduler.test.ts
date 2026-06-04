import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import app from "../index";
import { runMaintenanceCycle, stopScheduler } from "../scheduler";

const HOUR_MS = 60 * 60 * 1000;
const uniq = () => `medi101-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function tokenFor(userId: string, email: string, role: string): string {
  return jwt.sign({ userId, email, role }, process.env.JWT_SECRET!, { expiresIn: "1h" });
}

describe("MEDI-101 — background scheduler", () => {
  let adminId: string;
  let adminEmail: string;
  let patientId: string;
  let patientEmail: string;
  let doctorId: string;
  let staleApptId: string;
  let freshApptId: string;
  const userIds: string[] = [];

  beforeAll(async () => {
    adminEmail = `${uniq()}@admin.test`;
    const admin = await prisma.user.create({
      data: { email: adminEmail, password: "x", name: "Sched Admin", role: "ADMIN" },
    });
    adminId = admin.id;
    userIds.push(admin.id);

    patientEmail = `${uniq()}@patient.test`;
    const patient = await prisma.user.create({
      data: { email: patientEmail, password: "x", name: "Sched Patient", role: "PATIENT" },
    });
    patientId = patient.id;
    userIds.push(patient.id);

    const doctorUser = await prisma.user.create({
      data: { email: `${uniq()}@doctor.test`, password: "x", name: "Sched Doctor", role: "DOCTOR" },
    });
    userIds.push(doctorUser.id);
    const doctor = await prisma.doctor.create({
      data: { userId: doctorUser.id, specialization: "Testology" },
    });
    doctorId = doctor.id;

    const now = Date.now();

    // Stale: slot ended 2h ago, session never started → must be auto-cancelled.
    const staleSlot = await prisma.timeSlot.create({
      data: {
        doctorId,
        date: new Date(now - 3 * HOUR_MS),
        startTime: new Date(now - 3 * HOUR_MS),
        endTime: new Date(now - 2 * HOUR_MS),
        isBooked: true,
      },
    });
    staleApptId = (
      await prisma.appointment.create({
        data: { patientId, doctorId, timeSlotId: staleSlot.id, status: "BOOKED" },
      })
    ).id;

    // Fresh: slot ends in the future → outside the 1h cutoff, must stay BOOKED.
    const freshSlot = await prisma.timeSlot.create({
      data: {
        doctorId,
        date: new Date(now + HOUR_MS),
        startTime: new Date(now + HOUR_MS),
        endTime: new Date(now + 2 * HOUR_MS),
        isBooked: true,
      },
    });
    freshApptId = (
      await prisma.appointment.create({
        data: { patientId, doctorId, timeSlotId: freshSlot.id, status: "BOOKED" },
      })
    ).id;
  });

  afterAll(async () => {
    stopScheduler();
    await prisma.appointment.deleteMany({ where: { id: { in: [staleApptId, freshApptId] } } });
    await prisma.timeSlot.deleteMany({ where: { doctorId } });
    await prisma.doctor.deleteMany({ where: { id: doctorId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("runMaintenanceCycle auto-cancels stale appointments and leaves fresh ones", async () => {
    const result = await runMaintenanceCycle("manual");
    expect(result.autoCancelled).toBeGreaterThanOrEqual(1);
    expect(result).toHaveProperty("remindersSent");

    const stale = await prisma.appointment.findUnique({ where: { id: staleApptId } });
    expect(stale?.status).toBe("CANCELLED");

    const fresh = await prisma.appointment.findUnique({ where: { id: freshApptId } });
    expect(fresh?.status).toBe("BOOKED");
  });

  it("POST /api/admin/scheduler/run returns the cycle summary for an admin", async () => {
    const res = await request(app)
      .post("/api/admin/scheduler/run")
      .set("Authorization", `Bearer ${tokenFor(adminId, adminEmail, "ADMIN")}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("autoCancelled");
    expect(res.body.data).toHaveProperty("remindersSent");
  });

  it("rejects non-admins (403) and unauthenticated callers (401)", async () => {
    const patientRes = await request(app)
      .post("/api/admin/scheduler/run")
      .set("Authorization", `Bearer ${tokenFor(patientId, patientEmail, "PATIENT")}`);
    expect(patientRes.status).toBe(403);

    const anonRes = await request(app).post("/api/admin/scheduler/run");
    expect(anonRes.status).toBe(401);
  });
});
