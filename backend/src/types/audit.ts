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
  APPOINTMENT_BOOK:          "appointment.book",
  APPOINTMENT_CANCEL:        "appointment.cancel",
  APPOINTMENT_COMPLETE:      "appointment.complete",
  APPOINTMENT_NOTE_UPDATE:   "appointment.note_update",
  APPOINTMENT_START:         "appointment.start",
  APPOINTMENT_END:           "appointment.end",
  APPOINTMENT_AUTO_CANCEL:   "appointment.auto_cancel",

  // Admin: users
  USER_DELETE:       "user.delete",
  USER_ROLE_CHANGE:  "user.role_change",
  USER_DEACTIVATE:   "user.deactivate",
  USER_TITLE_CHANGE: "user.title_change",
  USER_SPECIALIZATION_CHANGE: "user.specialization_change",
  USER_GENDER_CHANGE: "user.gender_change",
  USER_DOB_CHANGE:    "user.dob_change",
  PASSWORD_CHANGE:   "user.password_change",

  // Admin: receptionist assignments
  ASSIGNMENT_ADD:    "receptionist.assignment_add",
  ASSIGNMENT_REMOVE: "receptionist.assignment_remove",

  SLOT_CREATE: "slot.create",
  SLOT_DELETE: "slot.delete",

  // Admin: departments
  DEPARTMENT_CREATE: "department.create",
  DEPARTMENT_DELETE: "department.delete",

  // Patient profile (self-service + staff edits)
  PROFILE_UPDATE_SELF:            "profile.update_self",
  PROFILE_UPDATE_BY_ADMIN:        "profile.update_by_admin",
  PROFILE_UPDATE_BY_RECEPTIONIST: "profile.update_by_receptionist",
  PROFILE_UPDATE_BY_DOCTOR:       "profile.update_by_doctor",

  // Verification codes (staff-initiated profile edits requiring patient confirmation)
  VERIFICATION_CODE_REQUEST:        "verification.request",
  VERIFICATION_CODE_VERIFY_SUCCESS: "verification.verify_success",
  VERIFICATION_CODE_VERIFY_FAILED:  "verification.verify_failed",
} as const;

export type AuditActionType = typeof AuditAction[keyof typeof AuditAction];