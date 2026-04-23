import { z } from "zod";
import { paginationQuerySchema } from "../utils/pagination";

export const bookAppointmentSchema = z.object({
  timeSlotId: z.string().uuid({ message: "timeSlotId must be a valid UUID" }),
});

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
