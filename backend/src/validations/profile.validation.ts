import { z } from "zod";

/**
 * Patient profile editor schema.
 *
 * All fields are optional (this is PATCH semantics) but the request must carry
 * at least one to be meaningful. `null` clears a value back to "unknown".
 *
 * Free-text fields are length-bounded so the JSON body limit (10kb) cannot be
 * filled by a single entry, and so the database doesn't accumulate "essay"
 * blobs in fields meant for short notes.
 */
const PHONE_REGEX = /^\+?[0-9 ()-]{6,20}$/;

const optionalNullableString = (max: number) =>
  z
    .union([
      z.string().trim().max(max),
      z.null(),
    ])
    .optional();

const optionalNullablePhone = z
  .union([
    z.string().trim().regex(PHONE_REGEX, "Invalid phone number format"),
    z.null(),
  ])
  .optional();

export const BLOOD_TYPES = [
  "A_POSITIVE",
  "A_NEGATIVE",
  "B_POSITIVE",
  "B_NEGATIVE",
  "AB_POSITIVE",
  "AB_NEGATIVE",
  "O_POSITIVE",
  "O_NEGATIVE",
  "UNKNOWN",
] as const;

export const PROFILE_GENDERS = ["MALE", "FEMALE", "OTHER", "UNDISCLOSED"] as const;

export const updateProfileSchema = z
  .object({
    phone: optionalNullablePhone,
    dateOfBirth: z
      .union([z.string().datetime(), z.string().date(), z.null()])
      .optional(),
    gender: z.enum(PROFILE_GENDERS).optional(),
    address: optionalNullableString(200),
    city: optionalNullableString(80),
    country: optionalNullableString(80),
    emergencyContactName: optionalNullableString(120),
    emergencyContactPhone: optionalNullablePhone,
    emergencyContactRelation: optionalNullableString(60),
    bloodType: z.enum(BLOOD_TYPES).optional(),
    allergies: optionalNullableString(1000),
    chronicConditions: optionalNullableString(1000),
    currentMedications: optionalNullableString(1000),
    nationalId: optionalNullableString(32),
    insuranceProvider: optionalNullableString(120),
    insurancePolicyNumber: optionalNullableString(60),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Provide at least one field to update.",
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
