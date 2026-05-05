import { z } from "zod";
import { paginationQuerySchema } from "../utils/pagination";
import { DOCTOR_TITLES } from "./admin.validation";

/**
 * Query schema for GET /doctors.
 *
 * Filters:
 * - q: case-insensitive partial match against doctor's user.name
 * - specialization: exact match against the curated department dictionary
 * - title: must match one of DOCTOR_TITLES
 * - gender: MALE / FEMALE / OTHER (UNDISCLOSED is not exposed as a filter)
 * - ageMin / ageMax: integer years; coerced from query strings
 */
export const listDoctorsQuerySchema = paginationQuerySchema.extend({
  q: z.string().min(1).optional(),
  specialization: z.string().min(1).optional(),
  title: z.enum(DOCTOR_TITLES).optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  ageMin: z.coerce.number().int().min(20).max(100).optional(),
  ageMax: z.coerce.number().int().min(20).max(100).optional(),
});

export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>;
