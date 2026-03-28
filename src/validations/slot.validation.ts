import { z } from "zod";

export const createSlotSchema = z
  .object({
    date: z.coerce.date().refine((d) => d >= new Date(), {
      message: "Date cannot be in the past",
    }),
    startTime: z.string().datetime({ message: "startTime must be a valid ISO datetime" }),
    endTime: z.string().datetime({ message: "endTime must be a valid ISO datetime" }),
  })
  .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const updateSlotSchema = z
  .object({
    date: z.coerce
      .date()
      .refine((d) => d >= new Date(), {
        message: "Date cannot be in the past",
      })
      .optional(),
    startTime: z
      .string()
      .datetime({ message: "startTime must be a valid ISO datetime" })
      .optional(),
    endTime: z.string().datetime({ message: "endTime must be a valid ISO datetime" }).optional(),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return new Date(data.endTime) > new Date(data.startTime);
      }
      return true;
    },
    {
      message: "endTime must be after startTime",
      path: ["endTime"],
    },
  );

export type CreateSlotInput = z.infer<typeof createSlotSchema>;
export type UpdateSlotInput = z.infer<typeof updateSlotSchema>;
