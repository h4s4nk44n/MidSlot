import { apiGet, apiPost, apiDelete } from "./api";
import type { DoctorMinimal, TimeSlot } from "./types";

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