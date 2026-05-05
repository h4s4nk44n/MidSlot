import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Department name must be at least 2 characters.")
    .max(80, "Department name must be at most 80 characters."),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
