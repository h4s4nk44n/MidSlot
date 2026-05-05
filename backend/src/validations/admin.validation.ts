import { z } from "zod";
import { paginationQuerySchema } from "../utils/pagination";

/**
 * Query schema for GET /admin/users.
 *
 * `active` accepts the strings "true"/"false" as well as actual booleans
 * because URLSearchParams gives us strings. `q` searches name + email.
 */
export const listAdminUsersQuerySchema = paginationQuerySchema.extend({
  role: z.enum(["DOCTOR", "PATIENT", "ADMIN", "RECEPTIONIST"]).optional(),
  q: z.string().min(1).optional(),
  active: z
    .union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")])
    .optional(),
});

export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;

/**
 * Body schema for PATCH /admin/users/:id.
 *
 * At least one of `role` or `isActive` must be present. Both fields are
 * optional so the same endpoint serves "change role" and "deactivate / reactivate".
 */
export const DOCTOR_TITLES = ["Dr.", "Specialist Dr.", "Assoc. Prof. Dr.", "Prof. Dr."] as const;

export const updateAdminUserSchema = z
  .object({
    role: z.enum(["DOCTOR", "PATIENT", "ADMIN", "RECEPTIONIST"]).optional(),
    isActive: z.boolean().optional(),
    title: z.enum(DOCTOR_TITLES).optional(),
    // Free string so legacy seed values stay valid; UI restricts choices to the
    // curated Department dictionary. Trim + length guard mirror department.validation.
    specialization: z.string().trim().min(2).max(80).optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "UNDISCLOSED"]).optional(),
    // ISO date or YYYY-MM-DD; null clears the value back to "unknown".
    dateOfBirth: z
      .union([z.string().datetime(), z.string().date(), z.null()])
      .optional(),
  })
  .refine(
    (v) =>
      v.role !== undefined ||
      v.isActive !== undefined ||
      v.title !== undefined ||
      v.specialization !== undefined ||
      v.gender !== undefined ||
      v.dateOfBirth !== undefined,
    {
      message:
        "Provide at least one of: role, isActive, title, specialization, gender, dateOfBirth.",
    },
  );

export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;
