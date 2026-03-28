import { z } from "zod";

export const bookAppointmentSchema = z.object({
  timeSlotId: z.string().uuid({ message: "timeSlotId must be a valid UUID" }),
});

export const updateStatusSchema = z.object({
  status: z.enum(["CANCELLED", "COMPLETED"], {
    message: "Status must be CANCELLED or COMPLETED",
  }),
});

export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
