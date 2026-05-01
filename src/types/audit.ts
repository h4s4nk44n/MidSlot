/**
 * AuditLog action codes.
 *
 * These are stored as plain strings in the database (not Prisma enums)
 * so that adding a new action does not require a migration.
 *
 * Convention: <domain>.<verb_in_snake_case>
 */
export const AuditAction = {
  // Auth
  LOGIN_SUCCESS:    "login.success",
  LOGIN_FAILED:     "login.failed",
  LOGIN_LOCKED:     "login.locked",
  LOGOUT:           "auth.logout",

  // Appointments
  APPOINTMENT_BOOK:     "appointment.book",
  APPOINTMENT_CANCEL:   "appointment.cancel",
  APPOINTMENT_COMPLETE: "appointment.complete",

  // Admin: users
  USER_DELETE:       "user.delete",
  USER_ROLE_CHANGE:  "user.role_change",
  USER_DEACTIVATE:   "user.deactivate",
  PASSWORD_CHANGE:   "user.password_change",

  // Admin: receptionist assignments
  ASSIGNMENT_ADD:    "receptionist.assignment_add",
  ASSIGNMENT_REMOVE: "receptionist.assignment_remove",
} as const;

export type AuditActionType = typeof AuditAction[keyof typeof AuditAction];