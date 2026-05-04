import { apiGet } from "./api";
import type { DoctorMinimal } from "./types";

/**
 * Fetch the list of doctors this receptionist has been assigned to.
 * Backend: GET /api/receptionist/doctors (auth: RECEPTIONIST).
 */
export function fetchAssignedDoctors(): Promise<DoctorMinimal[]> {
  return apiGet<DoctorMinimal[]>("/receptionist/doctors");
}