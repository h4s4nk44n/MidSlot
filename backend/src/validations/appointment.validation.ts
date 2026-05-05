import { z } from "zod";
import { paginationQuerySchema } from "../utils/pagination";

export const bookAppointmentSchema = z.object({
  timeSlotId: z.string().uuid({ message: "timeSlotId must be a valid UUID" }),
});

/**
 * CRIT-005: explicit schema for POST /appointments. Without this, the
 * controller used to destructure raw body fields, allowing unbounded `notes`
 * and a free-form `patientId` that only one branch sanitized.
 */
export const createAppointmentSchema = z.object({
  timeSlotId: z.string().uuid({ message: "timeSlotId must be a valid UUID" }),
  patientId: z
    .string()
    .uuid({ message: "patientId must be a valid UUID" })
    .optional(),
  notes: z
    .string()
    .max(2000, { message: "notes must be 2000 characters or fewer" })
    .optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const updateStatusSchema = z.object({
  status: z.enum(["CANCELLED", "COMPLETED"], {
    message: "Status must be CANCELLED or COMPLETED",
  }),
});

/**
 * Query schema for GET /appointments/me.
 * - status: AppointmentStatus enum
 * - from/to: ISO datetime range applied to the time slot's scheduled time
 */
export const listMyAppointmentsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["BOOKED", "CANCELLED", "COMPLETED"]).optional(),
  from: z.string().datetime({ message: "from must be a valid ISO datetime" }).optional(),
  to: z.string().datetime({ message: "to must be a valid ISO datetime" }).optional(),
});

export type ListMyAppointmentsQuery = z.infer<typeof listMyAppointmentsQuerySchema>;
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
