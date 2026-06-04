import {
  resolveEmailProvider,
  setEmailProvider,
  type EmailMessage,
  type EmailProvider,
} from "../lib/email";
import { prisma } from "../lib/prisma";
import { requestProfileChange, verifyCodeAndApply } from "../services/profile-change.service";

const uniq = () => `vcode-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

class CapturingEmailProvider implements EmailProvider {
  readonly name = "capture";
  sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

/**
 * Staff-initiated profile edits used to text the patient a 6-digit SMS code;
 * the code now goes out over the email adapter instead. These tests pin that
 * behaviour: the code is emailed (never SMS'd), the response hint is a masked
 * email, and a patient with no phone on file still works.
 */
describe("Verification code via email (staff profile edits)", () => {
  const fake = new CapturingEmailProvider();
  let patientId: string;
  let patientEmail: string;
  let receptionistId: string;
  const userIds: string[] = [];

  beforeAll(async () => {
    setEmailProvider(fake);

    patientEmail = `${uniq()}@patient.test`;
    const patient = await prisma.user.create({
      data: {
        email: patientEmail,
        password: "x",
        name: "Code Patient",
        role: "PATIENT",
        phone: "+15550000",
      },
    });
    patientId = patient.id;
    userIds.push(patient.id);

    const receptionist = await prisma.user.create({
      data: {
        email: `${uniq()}@staff.test`,
        password: "x",
        name: "Front Desk",
        role: "RECEPTIONIST",
      },
    });
    receptionistId = receptionist.id;
    userIds.push(receptionist.id);
  });

  afterAll(async () => {
    setEmailProvider(resolveEmailProvider());
    await prisma.verificationCode.deleteMany({ where: { targetUserId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("emails a 6-digit code, masks the hint, and applies the change on verify", async () => {
    const before = fake.sent.length;
    const result = await requestProfileChange({
      targetUserId: patientId,
      requesterId: receptionistId,
      purpose: "profile_edit_by_receptionist",
      payload: { city: "Izmir" },
    });

    // Code was emailed to the patient (never SMS'd).
    expect(fake.sent.length).toBe(before + 1);
    const email = fake.sent[fake.sent.length - 1];
    expect(email.to).toBe(patientEmail);
    expect(email.subject).toMatch(/verification code/i);
    const codeMatch = email.text?.match(/\d{6}/);
    expect(codeMatch).not.toBeNull();

    // Response carries a masked email hint + provider, never the raw address.
    expect(result.provider).toBe("capture");
    expect(result.emailHint).toContain("@patient.test");
    expect(result.emailHint).not.toBe(patientEmail);

    // Verifying with the emailed code applies the stashed change.
    const outcome = await verifyCodeAndApply(result.requestId, receptionistId, codeMatch![0]);
    expect(outcome.ok).toBe(true);
    const updated = await prisma.user.findUnique({ where: { id: patientId } });
    expect(updated?.city).toBe("Izmir");
  });

  it("works for a patient with no phone on file (email is the only channel now)", async () => {
    const noPhone = await prisma.user.create({
      data: { email: `${uniq()}@patient.test`, password: "x", name: "No Phone", role: "PATIENT" },
    });
    userIds.push(noPhone.id);

    const before = fake.sent.length;
    const result = await requestProfileChange({
      targetUserId: noPhone.id,
      requesterId: receptionistId,
      purpose: "profile_edit_by_receptionist",
      payload: { city: "Konya" },
    });

    expect(fake.sent.length).toBe(before + 1);
    expect(result.emailHint).toContain("@patient.test");
    expect(result.provider).toBe("capture");
  });
});
