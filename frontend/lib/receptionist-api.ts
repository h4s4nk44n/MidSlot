import { apiGet, apiPost, apiDelete } from "./api";
import type { DoctorMinimal, TimeSlot } from "./types";

export interface PatientResult {
  id: string;
  name: string;
  email: string;
}

export interface BookAppointmentPayload {
  patientId: string;
  timeSlotId: string;
  notes?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  timeSlotId: string;
  notes?: string | null;
  status: string;
  timeSlot: TimeSlot;
  patient: { id: string; name: string; email: string };
}

export function fetchAssignedDoctors(): Promise<DoctorMinimal[]> {
  return apiGet<DoctorMinimal[]>("/receptionist/doctors");
}

export function fetchDoctorSlots(doctorId: string): Promise<TimeSlot[]> {
  return apiGet<TimeSlot[]>(`/receptionist/doctors/${doctorId}/slots`);
}

export function createDoctorSlot(
  doctorId: string,
  payload: { date: string; startTime: string; endTime: string },
): Promise<{ message: string; data: TimeSlot }> {
  return apiPost(`/receptionist/doctors/${doctorId}/slots`, payload);
}

export function deleteDoctorSlot(slotId: string): Promise<{ message: string }> {
  return apiDelete(`/receptionist/slots/${slotId}`);
}

export function searchPatients(query: string, signal?: AbortSignal): Promise<PatientResult[]> {
  return apiGet<PatientResult[]>(`/receptionist/patients?search=${encodeURIComponent(query)}&limit=10`, { signal });
}

export function bookAppointmentOnBehalf(
  payload: BookAppointmentPayload,
): Promise<{ message: string; data: Appointment }> {
  return apiPost(`/receptionist/appointments`, payload);
}