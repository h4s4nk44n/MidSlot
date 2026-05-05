import { z } from "zod";
import { paginationQuerySchema } from "../utils/pagination";

/**
 * Query schema for GET /slots. Supports pagination + optional filters.
 * If both `date` and `from`/`to` are supplied, `date` takes precedence.
 */
export const listSlotsQuerySchema = paginationQuerySchema.extend({
  doctorId: z.string().uuid().optional(),
  specialization: z.string().min(1).optional(),
  date: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid date" })
    .optional(),
  from: z
    .string()
    .datetime({ message: "from must be a valid ISO datetime" })
    .optional(),
  to: z.string().datetime({ message: "to must be a valid ISO datetime" }).optional(),
});

export type ListSlotsQuery = z.infer<typeof listSlotsQuerySchema>;

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
