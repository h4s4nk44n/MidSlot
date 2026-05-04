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
export const updateAdminUserSchema = z
  .object({
    role: z.enum(["DOCTOR", "PATIENT", "ADMIN", "RECEPTIONIST"]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.role !== undefined || v.isActive !== undefined, {
    message: "Provide at least one of: role, isActive.",
  });

export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;
