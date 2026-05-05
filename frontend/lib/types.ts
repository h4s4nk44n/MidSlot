/**
 * Minimum backend-shared types. Keep in sync with prisma/schema.prisma.
 * A shared package is deferred — copy what we need here for now.
 */

export type Role = "DOCTOR" | "PATIENT" | "ADMIN" | "RECEPTIONIST";

export type AppointmentStatus = "BOOKED" | "CANCELLED" | "COMPLETED";

export type Gender = "MALE" | "FEMALE" | "OTHER" | "UNDISCLOSED";

export type BloodType =
  | "A_POSITIVE"
  | "A_NEGATIVE"
  | "B_POSITIVE"
  | "B_NEGATIVE"
  | "AB_POSITIVE"
  | "AB_NEGATIVE"
  | "O_POSITIVE"
  | "O_NEGATIVE"
  | "UNKNOWN";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/**
 * Full patient profile returned by GET /api/profile and the staff edit endpoints.
 * Most fields are nullable because they default to "unknown" until the user
 * fills them in via /patient/profile.
 */
export interface PatientProfile {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  dateOfBirth: string | null;
  gender: Gender;
  address: string | null;
  city: string | null;
  country: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  bloodType: BloodType;
  allergies: string | null;
  chronicConditions: string | null;
  currentMedications: string | null;
  nationalId: string | null;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  /** True for the seeded founder admin — protected from any role/active edits. */
  isFounder?: boolean;
  createdAt: string;
  doctor?: {
    title: string | null;
    specialization?: string | null;
    gender?: Gender | null;
    dateOfBirth?: string | null;
  } | null;
}

export interface Doctor {
  id: string;
  userId: string;
  title?: string | null;
  specialization: string;
  bio?: string | null;
  experienceYears?: number;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface DoctorMinimal {
  id: string;
  title?: string | null;
  specialization?: string | null;
  bio?: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface TimeSlot {
  id: string;
  doctorId: string;
  date: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
}