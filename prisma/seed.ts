import "dotenv/config";
import { PrismaClient, Role, AppointmentStatus } from "../src/generated/prisma";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();


// ─── Helpers: relative date builders ──────────────────────────────────────────
function daysFromNow(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function atTime(base: Date, hour: number, minute: number): Date {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ─── Main seed function ───────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("Starting database seed...\n");

  const hashedPassword = await bcrypt.hash("Password123!", 10);
  const hashedAdminPassword = await bcrypt.hash("Admin@MediSlot2026!", 10);

  await prisma.$transaction(async (tx) => {
    // ── 1. Cleanup (reverse dependency order) ──────────────────────────────
    console.log("Cleaning up existing data...");
    await tx.appointment.deleteMany();
    await tx.receptionistAssignment.deleteMany();
    await tx.timeSlot.deleteMany();
    await tx.doctor.deleteMany();
    await tx.user.deleteMany();
    console.log("   - All existing data removed\n");

    // ── 2. Create admin user ───────────────────────────────────────────────
    console.log("Creating admin user...");

    const adminUser = await tx.user.create({
      data: {
        email: "admin@medislot.com",
        password: hashedAdminPassword,
        name: "System Administrator",
        role: Role.ADMIN,
      },
    });

    // ── 3. Create receptionist users ──────────────────────────────────────
    console.log("Creating receptionist users...");

    const receptionist1 = await tx.user.create({
      data: {
        email: "fatma.celik@medislot.com",
        password: hashedPassword,
        name: "Fatma Çelik",
        role: Role.RECEPTIONIST,
      },
    });

    const receptionist2 = await tx.user.create({
      data: {
        email: "emre.sahin@medislot.com",
        password: hashedPassword,
        name: "Emre Şahin",
        role: Role.RECEPTIONIST,
      },
    });

    // ── 4. Create doctor users ─────────────────────────────────────────────
    console.log("Creating doctor users...");

    const doctorUser1 = await tx.user.create({
      data: {
        email: "ayse.yilmaz@medislot.com",
        password: hashedPassword,
        name: "Dr. Ayşe Yılmaz",
        role: Role.DOCTOR,
      },
    });

    const doctorUser2 = await tx.user.create({
      data: {
        email: "mehmet.kaya@medislot.com",
        password: hashedPassword,
        name: "Dr. Mehmet Kaya",
        role: Role.DOCTOR,
      },
    });

    const doctorUser3 = await tx.user.create({
      data: {
        email: "zeynep.demir@medislot.com",
        password: hashedPassword,
        name: "Dr. Zeynep Demir",
        role: Role.DOCTOR,
      },
    });

    // ── 5. Create doctor profiles ──────────────────────────────────────────
    console.log("Creating doctor profiles...");

    const doctor1 = await tx.doctor.create({
      data: {
        userId: doctorUser1.id,
        specialization: "Cardiology",
        bio: "Board-certified cardiologist with 15 years of experience in interventional cardiology and heart disease prevention.",
      },
    });

    const doctor2 = await tx.doctor.create({
      data: {
        userId: doctorUser2.id,
        specialization: "Dermatology",
        bio: "Specializing in medical and cosmetic dermatology, including skin cancer screening and treatment.",
      },
    });

    const doctor3 = await tx.doctor.create({
      data: {
        userId: doctorUser3.id,
        specialization: "General Practice",
        bio: "Family medicine practitioner providing comprehensive primary care for patients of all ages.",
      },
    });

    // ── 5. Create patient users ────────────────────────────────────────────
    console.log("Creating patient users...");

    const patient1 = await tx.user.create({
      data: {
        email: "ali.vural@example.com",
        password: hashedPassword,
        name: "Ali Vural",
        role: Role.PATIENT,
      },
    });

    const patient2 = await tx.user.create({
      data: {
        email: "can.ozkan@example.com",
        password: hashedPassword,
        name: "Can Özkan",
        role: Role.PATIENT,
      },
    });

    const patient3 = await tx.user.create({
      data: {
        email: "deniz.arslan@example.com",
        password: hashedPassword,
        name: "Deniz Arslan",
        role: Role.PATIENT,
      },
    });

    // ── 6. Create receptionist assignments ────────────────────────────────
    console.log("Creating receptionist assignments...");

    // Fatma is assigned to Dr. Ayşe (Cardiology) and Dr. Mehmet (Dermatology)
    await tx.receptionistAssignment.create({
      data: {
        receptionistId: receptionist1.id,
        doctorId: doctor1.id,
        assignedByUserId: adminUser.id,
      },
    });

    await tx.receptionistAssignment.create({
      data: {
        receptionistId: receptionist1.id,
        doctorId: doctor2.id,
        assignedByUserId: adminUser.id,
      },
    });

    // Emre is assigned to Dr. Zeynep (General Practice)
    await tx.receptionistAssignment.create({
      data: {
        receptionistId: receptionist2.id,
        doctorId: doctor3.id,
        assignedByUserId: adminUser.id,
      },
    });

    // ── 7. Create time slots ───────────────────────────────────────────────
    console.log("Creating time slots...");

    const pastDay1 = daysFromNow(-5);   // 5 days ago
    const pastDay2 = daysFromNow(-2);   // 2 days ago
    const today = daysFromNow(0);       // today
    const futureDay1 = daysFromNow(3);  // 3 days from now
    const futureDay2 = daysFromNow(7);  // 1 week from now
    const futureDay3 = daysFromNow(10); // 10 days from now

    // ── Doctor 1 (Ayşe – Cardiology) slots ─────────────────────────────────
    // Past slot (completed appointment)
    const slot1 = await tx.timeSlot.create({
      data: {
        doctorId: doctor1.id,
        date: pastDay1,
        startTime: atTime(pastDay1, 9, 0),
        endTime: atTime(pastDay1, 9, 30),
        isBooked: true,
      },
    });

    // Past slot (cancelled appointment)
    const slot2 = await tx.timeSlot.create({
      data: {
        doctorId: doctor1.id,
        date: pastDay2,
        startTime: atTime(pastDay2, 10, 0),
        endTime: atTime(pastDay2, 10, 30),
        isBooked: false, // cancelled, so slot freed up
      },
    });

    // Today slot (booked)
    const slot3 = await tx.timeSlot.create({
      data: {
        doctorId: doctor1.id,
        date: today,
        startTime: atTime(today, 14, 0),
        endTime: atTime(today, 14, 30),
        isBooked: true,
      },
    });

    // Future slot (available)
    await tx.timeSlot.create({
      data: {
        doctorId: doctor1.id,
        date: futureDay1,
        startTime: atTime(futureDay1, 9, 0),
        endTime: atTime(futureDay1, 10, 0),
        isBooked: false,
      },
    });

    // Future slot (available)
    await tx.timeSlot.create({
      data: {
        doctorId: doctor1.id,
        date: futureDay2,
        startTime: atTime(futureDay2, 11, 0),
        endTime: atTime(futureDay2, 11, 30),
        isBooked: false,
      },
    });

    // ── Doctor 2 (Mehmet – Dermatology) slots ──────────────────────────────
    // Past slot (completed)
    const slot6 = await tx.timeSlot.create({
      data: {
        doctorId: doctor2.id,
        date: pastDay1,
        startTime: atTime(pastDay1, 11, 0),
        endTime: atTime(pastDay1, 11, 30),
        isBooked: true,
      },
    });

    // Today slot (booked)
    await tx.timeSlot.create({
      data: {
        doctorId: doctor2.id,
        date: today,
        startTime: atTime(today, 9, 30),
        endTime: atTime(today, 10, 0),
        isBooked: true,
      },
    });

    // Future slot (available)
    await tx.timeSlot.create({
      data: {
        doctorId: doctor2.id,
        date: futureDay1,
        startTime: atTime(futureDay1, 13, 0),
        endTime: atTime(futureDay1, 14, 0),
        isBooked: false,
      },
    });

    // Future slot (available)
    await tx.timeSlot.create({
      data: {
        doctorId: doctor2.id,
        date: futureDay2,
        startTime: atTime(futureDay2, 15, 0),
        endTime: atTime(futureDay2, 15, 30),
        isBooked: false,
      },
    });

    // Future slot (available)
    await tx.timeSlot.create({
      data: {
        doctorId: doctor2.id,
        date: futureDay3,
        startTime: atTime(futureDay3, 10, 0),
        endTime: atTime(futureDay3, 10, 30),
        isBooked: false,
      },
    });

    // ── Doctor 3 (Zeynep – General) slots ──────────────────────────────────
    // Past slot (completed)
    await tx.timeSlot.create({
      data: {
        doctorId: doctor3.id,
        date: pastDay2,
        startTime: atTime(pastDay2, 14, 0),
        endTime: atTime(pastDay2, 14, 30),
        isBooked: true,
      },
    });

    // Today slot (available)
    await tx.timeSlot.create({
      data: {
        doctorId: doctor3.id,
        date: today,
        startTime: atTime(today, 16, 0),
        endTime: atTime(today, 17, 0),
        isBooked: false,
      },
    });

    // Future slot (booked)
    const slot13 = await tx.timeSlot.create({
      data: {
        doctorId: doctor3.id,
        date: futureDay1,
        startTime: atTime(futureDay1, 10, 0),
        endTime: atTime(futureDay1, 10, 30),
        isBooked: true,
      },
    });

    // Future slot (available)
    await tx.timeSlot.create({
      data: {
        doctorId: doctor3.id,
        date: futureDay2,
        startTime: atTime(futureDay2, 9, 0),
        endTime: atTime(futureDay2, 9, 30),
        isBooked: false,
      },
    });

    // Future slot (available)
    await tx.timeSlot.create({
      data: {
        doctorId: doctor3.id,
        date: futureDay3,
        startTime: atTime(futureDay3, 14, 0),
        endTime: atTime(futureDay3, 15, 0),
        isBooked: false,
      },
    });

    // ── 8. Create appointments ─────────────────────────────────────────────
    console.log("Creating appointments...");

    // Appointment 1: COMPLETED – Ali saw Dr. Ayşe (past)
    await tx.appointment.create({
      data: {
        patientId: patient1.id,
        doctorId: doctor1.id,
        timeSlotId: slot1.id,
        status: AppointmentStatus.COMPLETED,
        notes: "Routine cardiac checkup. ECG results normal. Follow-up in 6 months.",
      },
    });

    // Appointment 2: CANCELLED – Can cancelled with Dr. Ayşe (past)
    await tx.appointment.create({
      data: {
        patientId: patient2.id,
        doctorId: doctor1.id,
        timeSlotId: slot2.id,
        status: AppointmentStatus.CANCELLED,
        notes: "Patient cancelled due to scheduling conflict.",
      },
    });

    // Appointment 3: BOOKED – Deniz booked with Dr. Ayşe (today)
    await tx.appointment.create({
      data: {
        patientId: patient3.id,
        doctorId: doctor1.id,
        timeSlotId: slot3.id,
        status: AppointmentStatus.BOOKED,
        notes: "First-time visit for chest pain evaluation.",
      },
    });

    // Appointment 4: COMPLETED – Can saw Dr. Mehmet (past)
    await tx.appointment.create({
      data: {
        patientId: patient2.id,
        doctorId: doctor2.id,
        timeSlotId: slot6.id,
        status: AppointmentStatus.COMPLETED,
        notes: "Skin mole examination. No signs of malignancy. Annual follow-up recommended.",
      },
    });

    // Appointment 5: BOOKED – Ali booked with Dr. Zeynep (future)
    await tx.appointment.create({
      data: {
        patientId: patient1.id,
        doctorId: doctor3.id,
        timeSlotId: slot13.id,
        status: AppointmentStatus.BOOKED,
        notes: "Annual general health checkup.",
      },
    });

    // ── 9. Summary ─────────────────────────────────────────────────────────
    console.log("\nSeed completed successfully!");
    console.log("   - Created 1 admin, 2 receptionists, 3 doctors, 3 patients, 15 slots, 5 appointments, 3 assignments");
    console.log("\n   Admin:");
    console.log("   • admin@medislot.com          (Password: Admin@MediSlot2026!)");
    console.log("\n   Receptionists (Password: Password123!):");
    console.log("   • fatma.celik@medislot.com    → Dr. Ayşe (Cardiology), Dr. Mehmet (Dermatology)");
    console.log("   • emre.sahin@medislot.com     → Dr. Zeynep (General Practice)");
    console.log("\n   Doctors (Password: Password123!):");
    console.log("   • ayse.yilmaz@medislot.com   (Cardiology)");
    console.log("   • mehmet.kaya@medislot.com    (Dermatology)");
    console.log("   • zeynep.demir@medislot.com   (General Practice)");
    console.log("\n   Patients (Password: Password123!):");
    console.log("   • ali.vural@example.com");
    console.log("   • can.ozkan@example.com");
    console.log("   • deniz.arslan@example.com");
  });
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
