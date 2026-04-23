import { z } from "zod";
import { paginationQuerySchema } from "../utils/pagination";

/**
 * Query schema for GET /doctors.
 * - q: case-insensitive partial match against doctor's user.name
 * - specialization: exact match
 */
export const listDoctorsQuerySchema = paginationQuerySchema.extend({
  q: z.string().min(1).optional(),
  specialization: z.string().min(1).optional(),
});

export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>;
