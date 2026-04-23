import { z } from "zod";
import { paginationQuerySchema } from "../utils/pagination";

/**
 * Query schema for GET /admin/users.
 *
 * NOTE: `isActive` is intentionally omitted — the current User model has no
 * isActive column. Add the schema field + filter when the DB adds the column.
 */
export const listAdminUsersQuerySchema = paginationQuerySchema.extend({
  role: z.enum(["DOCTOR", "PATIENT", "ADMIN", "RECEPTIONIST"]).optional(),
  q: z.string().min(1).optional(),
});

export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;
