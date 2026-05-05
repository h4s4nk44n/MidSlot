import { z } from "zod";

export const receptionistCreateSlotSchema = z
  .object({
    date: z.coerce.date().refine((d) => d >= new Date(new Date().setHours(0, 0, 0, 0)), {
      message: "Date cannot be in the past",
    }),
    startTime: z.string().datetime({ message: "startTime must be a valid ISO datetime" }),
    endTime: z.string().datetime({ message: "endTime must be a valid ISO datetime" }),
  })
  .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const receptionistBookAppointmentSchema = z.object({
  patientId: z.string().uuid({ message: "patientId must be a valid UUID" }),
  timeSlotId: z.string().uuid({ message: "timeSlotId must be a valid UUID" }),
  notes: z.string().max(1000, { message: "notes must be <= 1000 characters" }).optional(),
});

export type ReceptionistCreateSlotInput = z.infer<typeof receptionistCreateSlotSchema>;
export type ReceptionistBookAppointmentInput = z.infer<typeof receptionistBookAppointmentSchema>;
