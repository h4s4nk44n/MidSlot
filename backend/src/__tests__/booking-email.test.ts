import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import app from "../index";
import {
  resolveEmailProvider,
  setEmailProvider,
  type EmailMessage,
  type EmailProvider,
} from "../lib/email";
import { buildBookingConfirmationEmail } from "../services/booking-email.service";

const HOUR_MS = 60 * 60 * 1000;
const uniq = () => `medi98-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

class CapturingEmailProvider implements EmailProvider {
  readonly name = "capture";
  sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

function tokenFor(userId: string, email: string, role: string): string {
  return jwt.sign({ userId, email, role }, process.env.JWT_SECRET!, { expiresIn: "1h" });
}

describe("MEDI-98 — booking confirmation email", () => {
  describe("adapter selection (resolveEmailProvider)", () => {
    const saved = {
      EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      EMAIL_FROM: process.env.EMAIL_FROM,
    };
    afterEach(() => {
      for (const k of ["EMAIL_PROVIDER", "RESEND_API_KEY", "EMAIL_FROM"] as const) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    });

    it("defaults to the console transport", () => {
      delete process.env.EMAIL_PROVIDER;
      expect(resolveEmailProvider().name).toBe("console");
    });

    it("uses Resend when EMAIL_PROVIDER=resend and creds are present", () => {
      process.env.EMAIL_PROVIDER = "resend";
      process.env.RESEND_API_KEY = "re_test_key";
      process.env.EMAIL_FROM = "noreply@medislot.test";
      expect(resolveEmailProvider().name).toBe("resend");
    });

    it("falls back to console when Resend creds are incomplete", () => {
      process.env.EMAIL_PROVIDER = "resend";
      delete process.env.RESEND_API_KEY;
      process.env.EMAIL_FROM = "noreply@medislot.test";
      expect(resolveEmailProvider().name).toBe("console");
    });
  });

  describe("confirmation template (buildBookingConfirmationEmail)", () => {
    it("includes the doctor, date and time", () => {
      const msg = buildBookingConfirmationEmail("pat@example.com", {
        patientName: "Pat Patient",
        doctorName: "Dr. Ada Lovelace",
        specialization: "Cardiology",
        startTime: new Date("2026-07-01T09:30:00.000Z"),
      });
      expect(msg.to).toBe("pat@example.com");
      expect(msg.subject).toContain("Dr. Ada Lovelace");
      expect(msg.text).toContain("Dr. Ada Lovelace");
      expect(msg.text).toContain("Cardiology");
      expect(msg.text).toContain("2026");
      expect(msg.html).toContain("Dr. Ada Lovelace");
    });
  });

  describe("POST /api/appointments delivers via the fake transport", () => {
    const fake = new CapturingEmailProvider();
    let patientId: string;
    let patientEmail: string;
    let doctorId: string;
    let slotId: string;
    const userIds: string[] = [];

    beforeAll(async () => {
      setEmailProvider(fake);

      patientEmail = `${uniq()}@patient.test`;
      const patient = await prisma.user.create({
        data: { email: patientEmail, password: "x", name: "Email Patient", role: "PATIENT" },
      });
      patientId = patient.id;
      userIds.push(patient.id);

      const doctorUser = await prisma.user.create({
        data: {
          email: `${uniq()}@doctor.test`,
          password: "x",
          name: "Grace Hopper",
          role: "DOCTOR",
        },
      });
      userIds.push(doctorUser.id);
      const doctor = await prisma.doctor.create({
        data: { userId: doctorUser.id, title: "Dr.", specialization: "Neurology" },
      });
      doctorId = doctor.id;

      const start = new Date(Date.now() + 48 * HOUR_MS);
      const slot = await prisma.timeSlot.create({
        data: {
          doctorId,
          date: start,
          startTime: start,
          endTime: new Date(start.getTime() + HOUR_MS),
          isBooked: false,
        },
      });
      slotId = slot.id;
    });

    afterAll(async () => {
      setEmailProvider(resolveEmailProvider());
      // The booking fires a fire-and-forget audit write (setImmediate). Let it
      // flush before we delete fixtures / disconnect so it can't race teardown
      // on a slow CI runner.
      await new Promise((resolve) => setImmediate(resolve));
      await prisma.appointment.deleteMany({ where: { timeSlotId: slotId } });
      await prisma.timeSlot.deleteMany({ where: { id: slotId } });
      await prisma.doctor.deleteMany({ where: { id: doctorId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    });

    it("captures an email to the patient with the appointment details", async () => {
      const before = fake.sent.length;
      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${tokenFor(patientId, patientEmail, "PATIENT")}`)
        .send({ timeSlotId: slotId, notes: "headache" });

      expect(res.status).toBe(201);
      expect(fake.sent.length).toBe(before + 1);
      const email = fake.sent[fake.sent.length - 1];
      expect(email.to).toBe(patientEmail);
      expect(email.subject).toContain("Grace Hopper");
      expect(email.text).toContain("Neurology");
    });
  });
});
