import { prisma } from "../lib/prisma";
import {
  setEmailProvider,
  resolveEmailProvider,
  type EmailMessage,
  type EmailProvider,
} from "../lib/email";
import { sendDueReminders, buildReminderEmail } from "../services/reminder.service";

const HOUR_MS = 60 * 60 * 1000;
const uniq = () => `medi99-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

class CapturingEmailProvider implements EmailProvider {
  readonly name = "capture";
  sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

describe("MEDI-99 — 24h reminder email", () => {
  describe("buildReminderEmail", () => {
    it("includes the doctor, date and time", () => {
      const msg = buildReminderEmail("pat@example.com", {
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
    });
  });

  describe("sendDueReminders (window + dedup)", () => {
    const fake = new CapturingEmailProvider();
    let doctorId: string;
    let patientEmail: string;
    let apptInWindow: string;
    let apptOutOfWindow: string;
    let apptAlreadyReminded: string;
    let apptCancelled: string;
    const userIds: string[] = [];
    const slotIds: string[] = [];
    const apptIds: string[] = [];

    beforeAll(async () => {
      setEmailProvider(fake);

      const doctorUser = await prisma.user.create({
        data: {
          email: `${uniq()}@doctor.test`,
          password: "x",
          name: "Ada Lovelace",
          role: "DOCTOR",
        },
      });
      userIds.push(doctorUser.id);
      const doctor = await prisma.doctor.create({
        data: { userId: doctorUser.id, title: "Dr.", specialization: "Cardiology" },
      });
      doctorId = doctor.id;

      const patient = await prisma.user.create({
        data: {
          email: `${uniq()}@patient.test`,
          password: "x",
          name: "Pat Patient",
          role: "PATIENT",
        },
      });
      userIds.push(patient.id);
      patientEmail = patient.email;

      const now = Date.now();
      const mk = async (
        offsetHours: number,
        opts: { status?: "BOOKED" | "CANCELLED"; reminderSentAt?: Date } = {},
      ) => {
        const start = new Date(now + offsetHours * HOUR_MS);
        const slot = await prisma.timeSlot.create({
          data: {
            doctorId,
            date: start,
            startTime: start,
            endTime: new Date(start.getTime() + HOUR_MS),
            isBooked: true,
          },
        });
        slotIds.push(slot.id);
        const appt = await prisma.appointment.create({
          data: {
            patientId: patient.id,
            doctorId,
            timeSlotId: slot.id,
            status: opts.status ?? "BOOKED",
            reminderSentAt: opts.reminderSentAt ?? null,
          },
        });
        apptIds.push(appt.id);
        return appt.id;
      };

      apptInWindow = await mk(24); // 24h ahead → inside [23h, 25h)
      apptOutOfWindow = await mk(30); // 30h ahead → outside
      apptAlreadyReminded = await mk(24, { reminderSentAt: new Date() }); // in window but done
      apptCancelled = await mk(24, { status: "CANCELLED" }); // in window but cancelled
    });

    afterAll(async () => {
      setEmailProvider(resolveEmailProvider());
      await prisma.appointment.deleteMany({ where: { id: { in: apptIds } } });
      await prisma.timeSlot.deleteMany({ where: { id: { in: slotIds } } });
      await prisma.doctor.deleteMany({ where: { id: doctorId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    });

    it("reminds only the in-window, BOOKED, not-yet-reminded appointment and stamps it", async () => {
      const before = fake.sent.length;
      const sent = await sendDueReminders();
      expect(sent).toBeGreaterThanOrEqual(1);

      const newEmails = fake.sent.slice(before);
      expect(newEmails.some((e) => e.to === patientEmail)).toBe(true);

      expect(
        (await prisma.appointment.findUnique({ where: { id: apptInWindow } }))?.reminderSentAt,
      ).not.toBeNull();
      expect(
        (await prisma.appointment.findUnique({ where: { id: apptOutOfWindow } }))?.reminderSentAt,
      ).toBeNull();
      expect(
        (await prisma.appointment.findUnique({ where: { id: apptCancelled } }))?.reminderSentAt,
      ).toBeNull();
    });

    it("does not send a second reminder on a later run (dedup)", async () => {
      const before = fake.sent.length;
      await sendDueReminders();
      const newEmails = fake.sent.slice(before);
      // The only in-window appointment for this patient is already reminded.
      expect(newEmails.some((e) => e.to === patientEmail)).toBe(false);
    });

    it("leaves the already-reminded appointment untouched", async () => {
      const a = await prisma.appointment.findUnique({ where: { id: apptAlreadyReminded } });
      expect(a?.reminderSentAt).not.toBeNull();
    });
  });
});
