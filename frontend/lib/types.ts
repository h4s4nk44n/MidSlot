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
