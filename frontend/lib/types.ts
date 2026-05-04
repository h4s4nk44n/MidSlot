/**
 * Minimum backend-shared types. Keep in sync with prisma/schema.prisma.
 * A shared package is deferred — copy what we need here for now.
 */

export type Role = "DOCTOR" | "PATIENT" | "ADMIN" | "RECEPTIONIST";

export type AppointmentStatus = "BOOKED" | "CANCELLED" | "COMPLETED";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Doctor {
  id: string;
  userId: string;
  specialization: string;
  bio?: string | null;
  experienceYears?: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface DoctorMinimal {
  id: string;
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