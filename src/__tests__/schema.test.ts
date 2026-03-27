import "dotenv/config";
import { PrismaClient, Role, AppointmentStatus } from "../generated/prisma/client";

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.appointment.deleteMany();
  await prisma.timeSlot.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.user.deleteMany();
});

function makeEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
}

// ---------------------------------------------------------------------------
// User model
// ---------------------------------------------------------------------------
describe("User model", () => {
  it("creates a user with all required fields", async () => {
    const user = await prisma.user.create({
      data: {
        email: makeEmail(),
        password: "hashed_password_123",
        name: "Test User",
        role: Role.PATIENT,
      },
    });

    expect(user.id).toBeDefined();
    expect(user.email).toContain("@test.com");
    expect(user.name).toBe("Test User");
    expect(user.role).toBe("PATIENT");
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it("enforces unique email constraint", async () => {
    const email = makeEmail();
    await prisma.user.create({
      data: { email, password: "pw1", name: "First", role: Role.PATIENT },
    });

    await expect(
      prisma.user.create({
        data: { email, password: "pw2", name: "Second", role: Role.DOCTOR },
      }),
    ).rejects.toThrow();
  });

  it("accepts both DOCTOR and PATIENT roles", async () => {
    const doctor = await prisma.user.create({
      data: { email: makeEmail(), password: "pw", name: "Dr. A", role: Role.DOCTOR },
    });
    const patient = await prisma.user.create({
      data: { email: makeEmail(), password: "pw", name: "Pat B", role: Role.PATIENT },
    });

    expect(doctor.role).toBe("DOCTOR");
    expect(patient.role).toBe("PATIENT");
  });
});

// ---------------------------------------------------------------------------
// Doctor model
// ---------------------------------------------------------------------------
describe("Doctor model", () => {
  it("creates a doctor linked to a user", async () => {
    const user = await prisma.user.create({
      data: { email: makeEmail(), password: "pw", name: "Dr. Smith", role: Role.DOCTOR },
    });

    const doctor = await prisma.doctor.create({
      data: { userId: user.id, specialization: "Cardiology", bio: "Expert" },
    });

    expect(doctor.id).toBeDefined();
    expect(doctor.userId).toBe(user.id);
    expect(doctor.specialization).toBe("Cardiology");
    expect(doctor.bio).toBe("Expert");
  });

  it("allows optional specialization and bio", async () => {
    const user = await prisma.user.create({
      data: { email: makeEmail(), password: "pw", name: "Dr. X", role: Role.DOCTOR },
    });

    const doctor = await prisma.doctor.create({ data: { userId: user.id } });

    expect(doctor.specialization).toBeNull();
    expect(doctor.bio).toBeNull();
  });

  it("enforces one-to-one with User (unique userId)", async () => {
    const user = await prisma.user.create({
      data: { email: makeEmail(), password: "pw", name: "Dr. Y", role: Role.DOCTOR },
    });

    await prisma.doctor.create({ data: { userId: user.id } });

    await expect(prisma.doctor.create({ data: { userId: user.id } })).rejects.toThrow();
  });

  it("can be queried through the User relation", async () => {
    const user = await prisma.user.create({
      data: {
        email: makeEmail(),
        password: "pw",
        name: "Dr. Rel",
        role: Role.DOCTOR,
        doctor: { create: { specialization: "Dermatology" } },
      },
      include: { doctor: true },
    });

    expect(user.doctor).not.toBeNull();
    expect(user.doctor!.specialization).toBe("Dermatology");
  });
});

// ---------------------------------------------------------------------------
// TimeSlot model
// ---------------------------------------------------------------------------
describe("TimeSlot model", () => {
  it("creates a time slot for a doctor", async () => {
    const user = await prisma.user.create({
      data: { email: makeEmail(), password: "pw", name: "Dr. T", role: Role.DOCTOR },
    });
    const doctor = await prisma.doctor.create({ data: { userId: user.id } });

    const slot = await prisma.timeSlot.create({
      data: {
        doctorId: doctor.id,
        date: new Date("2026-04-01"),
        startTime: new Date("2026-04-01T09:00:00Z"),
        endTime: new Date("2026-04-01T09:30:00Z"),
      },
    });

    expect(slot.id).toBeDefined();
    expect(slot.doctorId).toBe(doctor.id);
    expect(slot.isBooked).toBe(false);
    expect(slot.createdAt).toBeInstanceOf(Date);
  });

  it("defaults isBooked to false", async () => {
    const user = await prisma.user.create({
      data: { email: makeEmail(), password: "pw", name: "Dr. D", role: Role.DOCTOR },
    });
    const doctor = await prisma.doctor.create({ data: { userId: user.id } });

    const slot = await prisma.timeSlot.create({
      data: {
        doctorId: doctor.id,
        date: new Date("2026-05-01"),
        startTime: new Date("2026-05-01T10:00:00Z"),
        endTime: new Date("2026-05-01T10:30:00Z"),
      },
    });

    expect(slot.isBooked).toBe(false);
  });

  it("rejects a time slot with invalid doctorId (FK constraint)", async () => {
    await expect(
      prisma.timeSlot.create({
        data: {
          doctorId: "non-existent-id",
          date: new Date("2026-06-01"),
          startTime: new Date("2026-06-01T08:00:00Z"),
          endTime: new Date("2026-06-01T08:30:00Z"),
        },
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Appointment model
// ---------------------------------------------------------------------------
describe("Appointment model", () => {
  async function seedDoctorAndSlot() {
    const doctorUser = await prisma.user.create({
      data: { email: makeEmail(), password: "pw", name: "Dr. Appt", role: Role.DOCTOR },
    });
    const doctor = await prisma.doctor.create({ data: { userId: doctorUser.id } });
    const slot = await prisma.timeSlot.create({
      data: {
        doctorId: doctor.id,
        date: new Date("2026-07-01"),
        startTime: new Date("2026-07-01T14:00:00Z"),
        endTime: new Date("2026-07-01T14:30:00Z"),
      },
    });
    const patient = await prisma.user.create({
      data: { email: makeEmail(), password: "pw", name: "Patient P", role: Role.PATIENT },
    });
    return { doctorUser, doctor, slot, patient };
  }

  it("creates an appointment linking patient, doctor, and time slot", async () => {
    const { doctor, slot, patient } = await seedDoctorAndSlot();

    const appt = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        timeSlotId: slot.id,
      },
    });

    expect(appt.id).toBeDefined();
    expect(appt.status).toBe("BOOKED");
    expect(appt.notes).toBeNull();
    expect(appt.createdAt).toBeInstanceOf(Date);
    expect(appt.updatedAt).toBeInstanceOf(Date);
  });

  it("defaults status to BOOKED", async () => {
    const { doctor, slot, patient } = await seedDoctorAndSlot();

    const appt = await prisma.appointment.create({
      data: { patientId: patient.id, doctorId: doctor.id, timeSlotId: slot.id },
    });

    expect(appt.status).toBe(AppointmentStatus.BOOKED);
  });

  it("allows setting status to CANCELLED and COMPLETED", async () => {
    const { doctor, slot, patient } = await seedDoctorAndSlot();

    const appt = await prisma.appointment.create({
      data: { patientId: patient.id, doctorId: doctor.id, timeSlotId: slot.id },
    });

    const cancelled = await prisma.appointment.update({
      where: { id: appt.id },
      data: { status: AppointmentStatus.CANCELLED },
    });
    expect(cancelled.status).toBe("CANCELLED");

    const completed = await prisma.appointment.update({
      where: { id: appt.id },
      data: { status: AppointmentStatus.COMPLETED },
    });
    expect(completed.status).toBe("COMPLETED");
  });

  it("enforces unique timeSlotId (one appointment per slot)", async () => {
    const { doctor, slot, patient } = await seedDoctorAndSlot();

    await prisma.appointment.create({
      data: { patientId: patient.id, doctorId: doctor.id, timeSlotId: slot.id },
    });

    const patient2 = await prisma.user.create({
      data: { email: makeEmail(), password: "pw", name: "Patient 2", role: Role.PATIENT },
    });

    await expect(
      prisma.appointment.create({
        data: { patientId: patient2.id, doctorId: doctor.id, timeSlotId: slot.id },
      }),
    ).rejects.toThrow();
  });

  it("loads full relations via include", async () => {
    const { doctor, slot, patient } = await seedDoctorAndSlot();

    await prisma.appointment.create({
      data: { patientId: patient.id, doctorId: doctor.id, timeSlotId: slot.id },
    });

    const appt = await prisma.appointment.findFirst({
      include: { patient: true, doctor: true, timeSlot: true },
    });

    expect(appt!.patient.name).toBe("Patient P");
    expect(appt!.doctor.id).toBe(doctor.id);
    expect(appt!.timeSlot.id).toBe(slot.id);
  });
});

// ---------------------------------------------------------------------------
// Cascade delete behaviour
// ---------------------------------------------------------------------------
describe("Cascade deletes", () => {
  it("deleting a User cascades to their Doctor profile", async () => {
    const user = await prisma.user.create({
      data: {
        email: makeEmail(),
        password: "pw",
        name: "Dr. Cascade",
        role: Role.DOCTOR,
        doctor: { create: { specialization: "Surgery" } },
      },
      include: { doctor: true },
    });

    await prisma.user.delete({ where: { id: user.id } });

    const doctor = await prisma.doctor.findUnique({ where: { id: user.doctor!.id } });
    expect(doctor).toBeNull();
  });

  it("deleting a Doctor cascades to their TimeSlots", async () => {
    const user = await prisma.user.create({
      data: { email: makeEmail(), password: "pw", name: "Dr. Slot", role: Role.DOCTOR },
    });
    const doctor = await prisma.doctor.create({ data: { userId: user.id } });
    await prisma.timeSlot.create({
      data: {
        doctorId: doctor.id,
        date: new Date("2026-08-01"),
        startTime: new Date("2026-08-01T09:00:00Z"),
        endTime: new Date("2026-08-01T09:30:00Z"),
      },
    });

    await prisma.doctor.delete({ where: { id: doctor.id } });

    const slots = await prisma.timeSlot.findMany({ where: { doctorId: doctor.id } });
    expect(slots).toHaveLength(0);
  });

  it("deleting a Doctor cascades through TimeSlots to Appointments", async () => {
    const doctorUser = await prisma.user.create({
      data: { email: makeEmail(), password: "pw", name: "Dr. Full", role: Role.DOCTOR },
    });
    const doctor = await prisma.doctor.create({ data: { userId: doctorUser.id } });
    const slot = await prisma.timeSlot.create({
      data: {
        doctorId: doctor.id,
        date: new Date("2026-09-01"),
        startTime: new Date("2026-09-01T11:00:00Z"),
        endTime: new Date("2026-09-01T11:30:00Z"),
      },
    });
    const patient = await prisma.user.create({
      data: { email: makeEmail(), password: "pw", name: "Pat Full", role: Role.PATIENT },
    });
    await prisma.appointment.create({
      data: { patientId: patient.id, doctorId: doctor.id, timeSlotId: slot.id },
    });

    await prisma.doctor.delete({ where: { id: doctor.id } });

    const appts = await prisma.appointment.findMany({ where: { doctorId: doctor.id } });
    expect(appts).toHaveLength(0);
  });

  it("deleting a User (full chain) cascades to Doctor → TimeSlots → Appointments", async () => {
    const doctorUser = await prisma.user.create({
      data: { email: makeEmail(), password: "pw", name: "Dr. Chain", role: Role.DOCTOR },
    });
    const doctor = await prisma.doctor.create({ data: { userId: doctorUser.id } });
    const slot = await prisma.timeSlot.create({
      data: {
        doctorId: doctor.id,
        date: new Date("2026-10-01"),
        startTime: new Date("2026-10-01T15:00:00Z"),
        endTime: new Date("2026-10-01T15:30:00Z"),
      },
    });
    const patient = await prisma.user.create({
      data: { email: makeEmail(), password: "pw", name: "Pat Chain", role: Role.PATIENT },
    });
    await prisma.appointment.create({
      data: { patientId: patient.id, doctorId: doctor.id, timeSlotId: slot.id },
    });

    await prisma.user.delete({ where: { id: doctorUser.id } });

    expect(await prisma.doctor.findUnique({ where: { id: doctor.id } })).toBeNull();
    expect(await prisma.timeSlot.findMany({ where: { doctorId: doctor.id } })).toHaveLength(0);
    expect(await prisma.appointment.findMany({ where: { doctorId: doctor.id } })).toHaveLength(0);
  });
});
