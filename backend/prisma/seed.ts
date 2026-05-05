import "dotenv/config";
import { PrismaClient, Role, AppointmentStatus, Gender, BloodType } from "../src/generated/prisma";
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

  // HIGH-014: refuse to seed in production unless explicitly opted in. The
  // container CMD runs `node dist/seed.js` on every boot, which would create
  // deterministic admin/staff accounts in any production DB that happened to
  // be empty (data migration, fresh tenant, point-in-time recovery, …).
  if (process.env.NODE_ENV === "production" && process.env.SEED_PRODUCTION !== "true") {
    console.log(
      "Seed skipped — NODE_ENV=production and SEED_PRODUCTION is not 'true'.",
    );
    return;
  }

  // Idempotency guard: skip when the DB already has users so container
  // restarts (CMD runs seed every boot) don't wipe live data.
  if ((await prisma.user.count()) > 0) {
    console.log("Seed skipped — database already populated.");
    return;
  }

  // HIGH-014: passwords come from environment, not hardcoded literals. Refuse
  // to seed if the env values aren't provided AND we're not in a dev-style
  // environment (test / dev). This makes accidental production seeds with
  // known passwords impossible.
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
  const seedUserPassword = process.env.SEED_USER_PASSWORD;
  if (!seedAdminPassword || !seedUserPassword) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SEED_ADMIN_PASSWORD and SEED_USER_PASSWORD must be set when seeding in production.",
      );
    }
    console.log(
      "[seed] SEED_ADMIN_PASSWORD / SEED_USER_PASSWORD not set — using non-prod dev defaults.",
    );
  }
  const adminPlaintext = seedAdminPassword ?? "Admin@MediSlot2026!";
  const userPlaintext = seedUserPassword ?? "Password123!";

  const hashedPassword = await bcrypt.hash(userPlaintext, 12);
  const hashedAdminPassword = await bcrypt.hash(adminPlaintext, 12);

  await prisma.$transaction(async (tx) => {
    // ── 1. Cleanup (reverse dependency order) ──────────────────────────────
    console.log("Cleaning up existing data...");
    await tx.appointment.deleteMany();
    await tx.receptionistAssignment.deleteMany();
    await tx.timeSlot.deleteMany();
    await tx.doctor.deleteMany();
    await tx.user.deleteMany();
    await tx.department.deleteMany();
    console.log("   - All existing data removed\n");

    // ── Departments (source-of-truth dictionary for pickers) ──────────────
    console.log("Seeding departments...");
    const DEPARTMENTS = [
      "Cardiology",
      "Dermatology",
      "Endocrinology",
      "ENT (Otolaryngology)",
      "Family Medicine",
      "Gastroenterology",
      "General Practice",
      "General Surgery",
      "Gynecology",
      "Internal Medicine",
      "Neurology",
      "Obstetrics",
      "Oncology",
      "Ophthalmology",
      "Orthopedics",
      "Pediatrics",
      "Psychiatry",
      "Pulmonology",
      "Radiology",
      "Urology",
    ];
    await tx.department.createMany({
      data: DEPARTMENTS.map((name) => ({ name })),
    });

    // ── 2. Create admin user ───────────────────────────────────────────────
    console.log("Creating admin user...");

    const adminUser = await tx.user.create({
      data: {
        email: "admin@medislot.com",
        password: hashedAdminPassword,
        name: "System Administrator",
        role: Role.ADMIN,
        isFounder: true,
        phone: "+90 212 555 0100",
        dateOfBirth: new Date("1978-02-14"),
        gender: Gender.OTHER,
        address: "MediSlot HQ, Levent Cad. No:1",
        city: "Istanbul",
        country: "Turkey",
        emergencyContactName: "Operations Desk",
        emergencyContactPhone: "+90 212 555 0199",
        emergencyContactRelation: "Colleague",
        bloodType: BloodType.O_POSITIVE,
        nationalId: "10000000001",
      },
    });

    // ── 3. Create receptionist users ──────────────────────────────────────
    console.log("Creating receptionist users...");

    const receptionist1 = await tx.user.create({
      data: {
        email: "fatma.celik@medislot.com",
        password: hashedPassword,
        name: "Fatma Celik",
        role: Role.RECEPTIONIST,
        phone: "+90 532 444 1010",
        dateOfBirth: new Date("1992-07-22"),
        gender: Gender.FEMALE,
        address: "Bagdat Cad. No:80, Daire 12",
        city: "Istanbul",
        country: "Turkey",
        emergencyContactName: "Hakan Celik",
        emergencyContactPhone: "+90 532 444 1011",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.A_POSITIVE,
        nationalId: "20000000001",
      },
    });

    const receptionist2 = await tx.user.create({
      data: {
        email: "emre.sahin@medislot.com",
        password: hashedPassword,
        name: "Emre Sahin",
        role: Role.RECEPTIONIST,
        phone: "+90 533 555 2020",
        dateOfBirth: new Date("1988-12-03"),
        gender: Gender.MALE,
        address: "Tunali Hilmi Cad. No:55",
        city: "Ankara",
        country: "Turkey",
        emergencyContactName: "Selin Sahin",
        emergencyContactPhone: "+90 533 555 2021",
        emergencyContactRelation: "Sister",
        bloodType: BloodType.B_POSITIVE,
        nationalId: "20000000002",
      },
    });

    await tx.user.create({
      data: {
        email: "burcu.ozturk@medislot.com",
        password: hashedPassword,
        name: "Burcu Ozturk",
        role: Role.RECEPTIONIST,
        phone: "+90 534 666 3030",
        dateOfBirth: new Date("1995-03-15"),
        gender: Gender.FEMALE,
        address: "Kordon Boyu Cad. No:18, Daire 7",
        city: "Izmir",
        country: "Turkey",
        emergencyContactName: "Mert Ozturk",
        emergencyContactPhone: "+90 534 666 3031",
        emergencyContactRelation: "Brother",
        bloodType: BloodType.O_POSITIVE,
        nationalId: "20000000003",
      },
    });

    // ── 4. Create doctor users ─────────────────────────────────────────────
    console.log("Creating doctor users...");

    const doctorUser1 = await tx.user.create({
      data: {
        email: "ayse.yilmaz@medislot.com",
        password: hashedPassword,
        name: "Ayse Yilmaz",
        role: Role.DOCTOR,
        phone: "+90 532 700 1001",
        dateOfBirth: new Date("1972-04-18"),
        gender: Gender.FEMALE,
        address: "Nispetiye Cad. No:23, Daire 4",
        city: "Istanbul",
        country: "Turkey",
        emergencyContactName: "Kerem Yilmaz",
        emergencyContactPhone: "+90 532 700 1002",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.A_NEGATIVE,
        nationalId: "30000000001",
      },
    });

    const doctorUser2 = await tx.user.create({
      data: {
        email: "mehmet.kaya@medislot.com",
        password: hashedPassword,
        name: "Mehmet Kaya",
        role: Role.DOCTOR,
        phone: "+90 533 800 2002",
        dateOfBirth: new Date("1980-09-02"),
        gender: Gender.MALE,
        address: "Cankaya Mah. 12. Sok. No:9",
        city: "Ankara",
        country: "Turkey",
        emergencyContactName: "Elif Kaya",
        emergencyContactPhone: "+90 533 800 2003",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.O_POSITIVE,
        nationalId: "30000000002",
      },
    });

    const doctorUser3 = await tx.user.create({
      data: {
        email: "zeynep.demir@medislot.com",
        password: hashedPassword,
        name: "Zeynep Demir",
        role: Role.DOCTOR,
        phone: "+90 535 900 3003",
        dateOfBirth: new Date("1988-01-25"),
        gender: Gender.FEMALE,
        address: "Alsancak Mah. Kibris Sehitleri Cad. No:42",
        city: "Izmir",
        country: "Turkey",
        emergencyContactName: "Murat Demir",
        emergencyContactPhone: "+90 535 900 3004",
        emergencyContactRelation: "Brother",
        bloodType: BloodType.AB_POSITIVE,
        nationalId: "30000000003",
      },
    });

    // ── 5. Create doctor profiles ──────────────────────────────────────────
    console.log("Creating doctor profiles...");

    const doctor1 = await tx.doctor.create({
      data: {
        userId: doctorUser1.id,
        title: "Prof. Dr.",
        specialization: "Cardiology",
        bio: "Board-certified cardiologist with 15 years of experience in interventional cardiology and heart disease prevention.",
        gender: Gender.FEMALE,
        dateOfBirth: new Date("1972-04-18"),
      },
    });

    const doctor2 = await tx.doctor.create({
      data: {
        userId: doctorUser2.id,
        title: "Assoc. Prof. Dr.",
        specialization: "Dermatology",
        bio: "Specializing in medical and cosmetic dermatology, including skin cancer screening and treatment.",
        gender: Gender.MALE,
        dateOfBirth: new Date("1980-09-02"),
      },
    });

    const doctor3 = await tx.doctor.create({
      data: {
        userId: doctorUser3.id,
        title: "Specialist Dr.",
        specialization: "Family Medicine",
        bio: "Family medicine practitioner providing comprehensive primary care for patients of all ages.",
        gender: Gender.FEMALE,
        dateOfBirth: new Date("1988-01-25"),
      },
    });

    // ── Additional 15 doctors ──────────────────────────────────────────────
    const additionalDoctors: Array<{
      email: string;
      name: string;
      phone: string;
      dateOfBirth: string;
      gender: Gender;
      address: string;
      city: string;
      emergencyContactName: string;
      emergencyContactPhone: string;
      emergencyContactRelation: string;
      bloodType: BloodType;
      nationalId: string;
      title: string;
      specialization: string;
      bio: string;
    }> = [
      {
        email: "selim.korkmaz@medislot.com",
        name: "Selim Korkmaz",
        phone: "+90 532 700 1010",
        dateOfBirth: "1975-06-09",
        gender: Gender.MALE,
        address: "Etiler Mah. Nispetiye Cad. No:48",
        city: "Istanbul",
        emergencyContactName: "Lale Korkmaz",
        emergencyContactPhone: "+90 532 700 1011",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.O_POSITIVE,
        nationalId: "30000000004",
        title: "Prof. Dr.",
        specialization: "Endocrinology",
        bio: "Endocrinologist focused on diabetes management and thyroid disorders.",
      },
      {
        email: "pinar.aydin@medislot.com",
        name: "Pinar Aydin",
        phone: "+90 533 700 1020",
        dateOfBirth: "1982-11-14",
        gender: Gender.FEMALE,
        address: "Bagdat Cad. No:212, Daire 9",
        city: "Istanbul",
        emergencyContactName: "Cemil Aydin",
        emergencyContactPhone: "+90 533 700 1021",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.A_POSITIVE,
        nationalId: "30000000005",
        title: "Assoc. Prof. Dr.",
        specialization: "ENT (Otolaryngology)",
        bio: "ENT specialist with expertise in pediatric otolaryngology and sinus surgery.",
      },
      {
        email: "murat.dogan@medislot.com",
        name: "Murat Dogan",
        phone: "+90 535 700 1030",
        dateOfBirth: "1978-02-20",
        gender: Gender.MALE,
        address: "Kavaklidere Mah. Tunali Hilmi Cad. No:88",
        city: "Ankara",
        emergencyContactName: "Asli Dogan",
        emergencyContactPhone: "+90 535 700 1031",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.B_NEGATIVE,
        nationalId: "30000000006",
        title: "Specialist Dr.",
        specialization: "Gastroenterology",
        bio: "Gastroenterologist specializing in endoscopy and inflammatory bowel disease.",
      },
      {
        email: "elif.senturk@medislot.com",
        name: "Elif Senturk",
        phone: "+90 532 700 1040",
        dateOfBirth: "1984-07-03",
        gender: Gender.FEMALE,
        address: "Alsancak Mah. 1453 Sok. No:21",
        city: "Izmir",
        emergencyContactName: "Kerem Senturk",
        emergencyContactPhone: "+90 532 700 1041",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.AB_POSITIVE,
        nationalId: "30000000007",
        title: "Assoc. Prof. Dr.",
        specialization: "Gynecology",
        bio: "Gynecologist with focus on reproductive health and minimally invasive surgery.",
      },
      {
        email: "burak.kilic@medislot.com",
        name: "Burak Kilic",
        phone: "+90 533 700 1050",
        dateOfBirth: "1979-09-28",
        gender: Gender.MALE,
        address: "Konyaalti Cad. No:71",
        city: "Antalya",
        emergencyContactName: "Sibel Kilic",
        emergencyContactPhone: "+90 533 700 1051",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.O_NEGATIVE,
        nationalId: "30000000008",
        title: "Prof. Dr.",
        specialization: "Internal Medicine",
        bio: "Internist providing comprehensive adult care with focus on chronic disease management.",
      },
      {
        email: "hande.aksoy@medislot.com",
        name: "Hande Aksoy",
        phone: "+90 535 700 1060",
        dateOfBirth: "1981-05-12",
        gender: Gender.FEMALE,
        address: "Cankaya Mah. Ataturk Bulvari No:155",
        city: "Ankara",
        emergencyContactName: "Tarik Aksoy",
        emergencyContactPhone: "+90 535 700 1061",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.A_NEGATIVE,
        nationalId: "30000000009",
        title: "Assoc. Prof. Dr.",
        specialization: "Neurology",
        bio: "Neurologist with research interest in epilepsy and movement disorders.",
      },
      {
        email: "cem.tekin@medislot.com",
        name: "Cem Tekin",
        phone: "+90 532 700 1070",
        dateOfBirth: "1973-12-01",
        gender: Gender.MALE,
        address: "Levent Mah. Buyukdere Cad. No:201",
        city: "Istanbul",
        emergencyContactName: "Burcu Tekin",
        emergencyContactPhone: "+90 532 700 1071",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.B_POSITIVE,
        nationalId: "30000000010",
        title: "Prof. Dr.",
        specialization: "Oncology",
        bio: "Medical oncologist with extensive experience in solid tumor treatment.",
      },
      {
        email: "sevda.polat@medislot.com",
        name: "Sevda Polat",
        phone: "+90 533 700 1080",
        dateOfBirth: "1986-04-17",
        gender: Gender.FEMALE,
        address: "Karsiyaka Mah. Cemal Gursel Cad. No:33",
        city: "Izmir",
        emergencyContactName: "Eda Polat",
        emergencyContactPhone: "+90 533 700 1081",
        emergencyContactRelation: "Sister",
        bloodType: BloodType.O_POSITIVE,
        nationalId: "30000000011",
        title: "Specialist Dr.",
        specialization: "Ophthalmology",
        bio: "Ophthalmologist specializing in cataract surgery and refractive procedures.",
      },
      {
        email: "onur.erdem@medislot.com",
        name: "Onur Erdem",
        phone: "+90 535 700 1090",
        dateOfBirth: "1977-08-22",
        gender: Gender.MALE,
        address: "Bahcelievler Mah. 7. Cad. No:44",
        city: "Ankara",
        emergencyContactName: "Pelin Erdem",
        emergencyContactPhone: "+90 535 700 1091",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.A_POSITIVE,
        nationalId: "30000000012",
        title: "Assoc. Prof. Dr.",
        specialization: "Orthopedics",
        bio: "Orthopedic surgeon with subspecialty interest in sports medicine and joint replacement.",
      },
      {
        email: "gizem.cetin@medislot.com",
        name: "Gizem Cetin",
        phone: "+90 532 700 1100",
        dateOfBirth: "1989-10-05",
        gender: Gender.FEMALE,
        address: "Moda Cad. No:58, Daire 3",
        city: "Istanbul",
        emergencyContactName: "Hulya Cetin",
        emergencyContactPhone: "+90 532 700 1101",
        emergencyContactRelation: "Mother",
        bloodType: BloodType.AB_NEGATIVE,
        nationalId: "30000000013",
        title: "Specialist Dr.",
        specialization: "Pediatrics",
        bio: "Pediatrician dedicated to well-child care, immunizations, and developmental assessments.",
      },
      {
        email: "tolga.bozkurt@medislot.com",
        name: "Tolga Bozkurt",
        phone: "+90 533 700 1110",
        dateOfBirth: "1976-01-30",
        gender: Gender.MALE,
        address: "Konak Mah. Mithatpasa Cad. No:117",
        city: "Izmir",
        emergencyContactName: "Nihan Bozkurt",
        emergencyContactPhone: "+90 533 700 1111",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.O_POSITIVE,
        nationalId: "30000000014",
        title: "Assoc. Prof. Dr.",
        specialization: "Psychiatry",
        bio: "Psychiatrist with focus on mood disorders and cognitive behavioral therapy.",
      },
      {
        email: "ece.yildiz@medislot.com",
        name: "Ece Yildiz",
        phone: "+90 535 700 1120",
        dateOfBirth: "1983-06-26",
        gender: Gender.FEMALE,
        address: "Yenimahalle Mah. Ragip Tuzun Cad. No:90",
        city: "Ankara",
        emergencyContactName: "Serkan Yildiz",
        emergencyContactPhone: "+90 535 700 1121",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.B_POSITIVE,
        nationalId: "30000000015",
        title: "Specialist Dr.",
        specialization: "Pulmonology",
        bio: "Pulmonologist with expertise in asthma, COPD, and sleep medicine.",
      },
      {
        email: "baris.acar@medislot.com",
        name: "Baris Acar",
        phone: "+90 532 700 1130",
        dateOfBirth: "1980-03-11",
        gender: Gender.MALE,
        address: "Sisli Mah. Halaskargazi Cad. No:225",
        city: "Istanbul",
        emergencyContactName: "Defne Acar",
        emergencyContactPhone: "+90 532 700 1131",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.A_POSITIVE,
        nationalId: "30000000016",
        title: "Assoc. Prof. Dr.",
        specialization: "Radiology",
        bio: "Radiologist specializing in MRI interpretation and interventional procedures.",
      },
      {
        email: "nazli.karaca@medislot.com",
        name: "Nazli Karaca",
        phone: "+90 533 700 1140",
        dateOfBirth: "1985-09-19",
        gender: Gender.FEMALE,
        address: "Bornova Mah. Ergene Cad. No:14",
        city: "Izmir",
        emergencyContactName: "Mert Karaca",
        emergencyContactPhone: "+90 533 700 1141",
        emergencyContactRelation: "Brother",
        bloodType: BloodType.O_NEGATIVE,
        nationalId: "30000000017",
        title: "Specialist Dr.",
        specialization: "Urology",
        bio: "Urologist with focus on minimally invasive procedures and stone disease.",
      },
      {
        email: "ozan.simsek@medislot.com",
        name: "Ozan Simsek",
        phone: "+90 535 700 1150",
        dateOfBirth: "1974-11-07",
        gender: Gender.MALE,
        address: "Atasehir Mah. Barbaros Mah. No:67",
        city: "Istanbul",
        emergencyContactName: "Tuba Simsek",
        emergencyContactPhone: "+90 535 700 1151",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.A_NEGATIVE,
        nationalId: "30000000018",
        title: "Prof. Dr.",
        specialization: "General Surgery",
        bio: "General surgeon with broad experience in laparoscopic and emergency surgery.",
      },
    ];

    for (const d of additionalDoctors) {
      const dob = new Date(d.dateOfBirth);
      const u = await tx.user.create({
        data: {
          email: d.email,
          password: hashedPassword,
          name: d.name,
          role: Role.DOCTOR,
          phone: d.phone,
          dateOfBirth: dob,
          gender: d.gender,
          address: d.address,
          city: d.city,
          country: "Turkey",
          emergencyContactName: d.emergencyContactName,
          emergencyContactPhone: d.emergencyContactPhone,
          emergencyContactRelation: d.emergencyContactRelation,
          bloodType: d.bloodType,
          nationalId: d.nationalId,
        },
      });
      await tx.doctor.create({
        data: {
          userId: u.id,
          title: d.title,
          specialization: d.specialization,
          bio: d.bio,
          gender: d.gender,
          dateOfBirth: dob,
        },
      });
    }

    // ── 5. Create patient users ────────────────────────────────────────────
    console.log("Creating patient users...");

    const patient1 = await tx.user.create({
      data: {
        email: "ali.vural@example.com",
        password: hashedPassword,
        name: "Ali Vural",
        role: Role.PATIENT,
        phone: "+90 532 111 2233",
        dateOfBirth: new Date("1990-06-12"),
        gender: Gender.MALE,
        address: "Bagdat Cad. No:120, Daire 5",
        city: "Istanbul",
        country: "Turkey",
        emergencyContactName: "Ayla Vural",
        emergencyContactPhone: "+90 532 998 7766",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.A_POSITIVE,
        allergies: "Penicillin",
        chronicConditions: "Mild asthma",
        currentMedications: "Salbutamol inhaler as needed",
        nationalId: "12345678901",
        insuranceProvider: "SGK",
        insurancePolicyNumber: "SGK-2026-0001",
      },
    });

    const patient2 = await tx.user.create({
      data: {
        email: "can.ozkan@example.com",
        password: hashedPassword,
        name: "Can Ozkan",
        role: Role.PATIENT,
        phone: "+90 533 444 5566",
        dateOfBirth: new Date("1985-11-30"),
        gender: Gender.MALE,
        address: "Ataturk Bulvari No:45",
        city: "Ankara",
        country: "Turkey",
        emergencyContactName: "Mehmet Ozkan",
        emergencyContactPhone: "+90 533 700 8800",
        emergencyContactRelation: "Brother",
        bloodType: BloodType.O_NEGATIVE,
        allergies: null,
        chronicConditions: "Type 2 diabetes",
        currentMedications: "Metformin 500mg, twice daily",
        nationalId: "23456789012",
        insuranceProvider: "Allianz",
        insurancePolicyNumber: "ALZ-994221",
      },
    });

    const patient3 = await tx.user.create({
      data: {
        email: "deniz.arslan@example.com",
        password: hashedPassword,
        name: "Deniz Arslan",
        role: Role.PATIENT,
        phone: "+90 535 222 3344",
        dateOfBirth: new Date("1998-03-08"),
        gender: Gender.FEMALE,
        address: "Cumhuriyet Mah. 1453 Sok. No:8",
        city: "Izmir",
        country: "Turkey",
        emergencyContactName: "Selin Arslan",
        emergencyContactPhone: "+90 535 600 1122",
        emergencyContactRelation: "Mother",
        bloodType: BloodType.B_POSITIVE,
        allergies: "Pollen, peanuts",
        chronicConditions: null,
        currentMedications: null,
        nationalId: "34567890123",
        insuranceProvider: "Anadolu Sigorta",
        insurancePolicyNumber: "ANS-77-3321",
      },
    });

    // ── Additional 5 patients ──────────────────────────────────────────────
    const additionalPatients: Array<{
      email: string;
      name: string;
      phone: string;
      dateOfBirth: string;
      gender: Gender;
      address: string;
      city: string;
      emergencyContactName: string;
      emergencyContactPhone: string;
      emergencyContactRelation: string;
      bloodType: BloodType;
      allergies: string | null;
      chronicConditions: string | null;
      currentMedications: string | null;
      nationalId: string;
      insuranceProvider: string;
      insurancePolicyNumber: string;
    }> = [
      {
        email: "berna.aktas@example.com",
        name: "Berna Aktas",
        phone: "+90 532 333 4455",
        dateOfBirth: "1991-04-21",
        gender: Gender.FEMALE,
        address: "Caddebostan Mah. Plaj Yolu Sok. No:14",
        city: "Istanbul",
        emergencyContactName: "Hakan Aktas",
        emergencyContactPhone: "+90 532 333 4456",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.A_NEGATIVE,
        allergies: "Sulfa drugs",
        chronicConditions: "Hypothyroidism",
        currentMedications: "Levothyroxine 75mcg daily",
        nationalId: "45678901234",
        insuranceProvider: "Axa Sigorta",
        insurancePolicyNumber: "AXA-2026-5511",
      },
      {
        email: "tugce.kose@example.com",
        name: "Tugce Kose",
        phone: "+90 533 555 6677",
        dateOfBirth: "1996-09-14",
        gender: Gender.FEMALE,
        address: "Kizilay Mah. Necatibey Cad. No:62",
        city: "Ankara",
        emergencyContactName: "Asuman Kose",
        emergencyContactPhone: "+90 533 555 6678",
        emergencyContactRelation: "Mother",
        bloodType: BloodType.O_POSITIVE,
        allergies: null,
        chronicConditions: null,
        currentMedications: null,
        nationalId: "56789012345",
        insuranceProvider: "SGK",
        insurancePolicyNumber: "SGK-2026-0042",
      },
      {
        email: "hakan.aslan@example.com",
        name: "Hakan Aslan",
        phone: "+90 535 777 8899",
        dateOfBirth: "1978-12-05",
        gender: Gender.MALE,
        address: "Bornova Mah. 174 Sok. No:9",
        city: "Izmir",
        emergencyContactName: "Yasemin Aslan",
        emergencyContactPhone: "+90 535 777 8900",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.B_POSITIVE,
        allergies: "Latex",
        chronicConditions: "Hypertension",
        currentMedications: "Amlodipine 5mg daily",
        nationalId: "67890123456",
        insuranceProvider: "Allianz",
        insurancePolicyNumber: "ALZ-2026-1188",
      },
      {
        email: "yusuf.gunes@example.com",
        name: "Yusuf Gunes",
        phone: "+90 532 999 1122",
        dateOfBirth: "2001-05-18",
        gender: Gender.MALE,
        address: "Konyaalti Mah. Ataturk Bulvari No:22",
        city: "Antalya",
        emergencyContactName: "Mustafa Gunes",
        emergencyContactPhone: "+90 532 999 1123",
        emergencyContactRelation: "Father",
        bloodType: BloodType.AB_POSITIVE,
        allergies: null,
        chronicConditions: null,
        currentMedications: null,
        nationalId: "78901234567",
        insuranceProvider: "SGK",
        insurancePolicyNumber: "SGK-2026-0078",
      },
      {
        email: "irem.tan@example.com",
        name: "Irem Tan",
        phone: "+90 533 444 7788",
        dateOfBirth: "1987-08-02",
        gender: Gender.FEMALE,
        address: "Atasehir Mah. Bulvar Cad. No:101, Daire 11",
        city: "Istanbul",
        emergencyContactName: "Eren Tan",
        emergencyContactPhone: "+90 533 444 7789",
        emergencyContactRelation: "Spouse",
        bloodType: BloodType.O_NEGATIVE,
        allergies: "Shellfish",
        chronicConditions: "Migraine",
        currentMedications: "Sumatriptan as needed",
        nationalId: "89012345678",
        insuranceProvider: "Anadolu Sigorta",
        insurancePolicyNumber: "ANS-2026-9920",
      },
    ];

    for (const p of additionalPatients) {
      await tx.user.create({
        data: {
          email: p.email,
          password: hashedPassword,
          name: p.name,
          role: Role.PATIENT,
          phone: p.phone,
          dateOfBirth: new Date(p.dateOfBirth),
          gender: p.gender,
          address: p.address,
          city: p.city,
          country: "Turkey",
          emergencyContactName: p.emergencyContactName,
          emergencyContactPhone: p.emergencyContactPhone,
          emergencyContactRelation: p.emergencyContactRelation,
          bloodType: p.bloodType,
          allergies: p.allergies,
          chronicConditions: p.chronicConditions,
          currentMedications: p.currentMedications,
          nationalId: p.nationalId,
          insuranceProvider: p.insuranceProvider,
          insurancePolicyNumber: p.insurancePolicyNumber,
        },
      });
    }

    // ── 6. Create receptionist assignments ────────────────────────────────
    console.log("Creating receptionist assignments...");

    // Fatma is assigned to Dr. Ayse (Cardiology) and Dr. Mehmet (Dermatology)
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

    // ── Doctor 1 (Ayse – Cardiology) slots ─────────────────────────────────
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

    // Appointment 1: COMPLETED – Ali saw Dr. Ayse (past)
    await tx.appointment.create({
      data: {
        patientId: patient1.id,
        doctorId: doctor1.id,
        timeSlotId: slot1.id,
        status: AppointmentStatus.COMPLETED,
        notes: "Routine cardiac checkup. ECG results normal. Follow-up in 6 months.",
        // Session was opened on time and closed shortly after the slot's end.
        startedAt: atTime(pastDay1, 9, 2),
        endedAt: atTime(pastDay1, 9, 28),
        doctorNote:
          "ECG within normal limits. BP 122/78. No new symptoms. Continue current regimen and review in 6 months.",
      },
    });

    // Appointment 2: CANCELLED – Can cancelled with Dr. Ayse (past)
    await tx.appointment.create({
      data: {
        patientId: patient2.id,
        doctorId: doctor1.id,
        timeSlotId: slot2.id,
        status: AppointmentStatus.CANCELLED,
        notes: "Patient cancelled due to scheduling conflict.",
      },
    });

    // Appointment 3: BOOKED – Deniz booked with Dr. Ayse (today)
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
        startedAt: atTime(pastDay1, 11, 1),
        endedAt: atTime(pastDay1, 11, 32),
        doctorNote:
          "Two pigmented lesions on upper back examined. Benign appearance, no biopsy needed. Patient advised on sun protection; annual full-body screening recommended.",
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
    console.log("   - Created 1 admin, 3 receptionists, 18 doctors, 8 patients, 15 slots, 5 appointments, 3 assignments");
    // HIGH-014: never print plaintext passwords — they leak into log files,
    // CI artifacts, and container output. Operators receive credentials via
    // SEED_*_PASSWORD env values which they themselves provided.
    console.log("\n   Admin:");
    console.log("   • admin@medislot.com");
    console.log("\n   Receptionists:");
    console.log("   • fatma.celik@medislot.com    → Dr. Ayse (Cardiology), Dr. Mehmet (Dermatology)");
    console.log("   • emre.sahin@medislot.com     → Dr. Zeynep (General Practice)");
    console.log("   • burcu.ozturk@medislot.com   (unassigned)");
    console.log("\n   Doctors:");
    console.log("   • ayse.yilmaz@medislot.com    (Cardiology)");
    console.log("   • mehmet.kaya@medislot.com    (Dermatology)");
    console.log("   • zeynep.demir@medislot.com   (Family Medicine)");
    console.log("   • selim.korkmaz@medislot.com  (Endocrinology)");
    console.log("   • pinar.aydin@medislot.com    (ENT)");
    console.log("   • murat.dogan@medislot.com    (Gastroenterology)");
    console.log("   • elif.senturk@medislot.com   (Gynecology)");
    console.log("   • burak.kilic@medislot.com    (Internal Medicine)");
    console.log("   • hande.aksoy@medislot.com    (Neurology)");
    console.log("   • cem.tekin@medislot.com      (Oncology)");
    console.log("   • sevda.polat@medislot.com    (Ophthalmology)");
    console.log("   • onur.erdem@medislot.com     (Orthopedics)");
    console.log("   • gizem.cetin@medislot.com    (Pediatrics)");
    console.log("   • tolga.bozkurt@medislot.com  (Psychiatry)");
    console.log("   • ece.yildiz@medislot.com     (Pulmonology)");
    console.log("   • baris.acar@medislot.com     (Radiology)");
    console.log("   • nazli.karaca@medislot.com   (Urology)");
    console.log("   • ozan.simsek@medislot.com    (General Surgery)");
    console.log("\n   Patients:");
    console.log("   • ali.vural@example.com");
    console.log("   • can.ozkan@example.com");
    console.log("   • deniz.arslan@example.com");
    console.log("   • berna.aktas@example.com");
    console.log("   • tugce.kose@example.com");
    console.log("   • hakan.aslan@example.com");
    console.log("   • yusuf.gunes@example.com");
    console.log("   • irem.tan@example.com");
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
