import { prisma } from "../lib/prisma";
import { NotFoundError, ConflictError } from "../utils/errors";
import { Prisma } from "../generated/prisma";
import type { UpdateProfileInput } from "../validations/profile.validation";

/**
 * Columns the profile editor can read/write. Excludes auth + audit fields
 * (password, loginAttempts, lockedUntil) and identifiers managed elsewhere
 * (role, isActive). `name` and `email` are exposed read-only here; admins
 * change them via /admin/users.
 */
export const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  phone: true,
  dateOfBirth: true,
  gender: true,
  address: true,
  city: true,
  country: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  emergencyContactRelation: true,
  bloodType: true,
  allergies: true,
  chronicConditions: true,
  currentMedications: true,
  nationalId: true,
  insuranceProvider: true,
  insurancePolicyNumber: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PROFILE_SELECT,
  });
  if (!user) throw new NotFoundError("User not found.");
  return user;
}

/**
 * Translate the validator-produced patch into a `Prisma.UserUpdateInput` that
 * can be passed to either `prisma.user.update` or a transaction-scoped
 * `tx.user.update`. Centralised so the verification flow (which needs to run
 * inside a transaction with the consume step) and the direct self-edit path
 * stay in sync.
 *
 * - `undefined` keys are skipped (PATCH semantics).
 * - `null` clears the value (Prisma will set the column to NULL).
 * - `dateOfBirth` strings are coerced to Date.
 * - Trimmed empty strings on free-text fields are coerced to `null` so the UI
 *   can clear a field by submitting "".
 */
export function buildProfileUpdateData(
  patch: UpdateProfileInput,
): Prisma.UserUpdateInput {
  const data: Prisma.UserUpdateInput = {};

  const assignString = (key: keyof UpdateProfileInput) => {
    const v = patch[key];
    if (v === undefined) return;
    if (v === null || (typeof v === "string" && v.trim() === "")) {
      (data as Record<string, unknown>)[key] = null;
    } else {
      (data as Record<string, unknown>)[key] = v;
    }
  };

  assignString("phone");
  assignString("address");
  assignString("city");
  assignString("country");
  assignString("emergencyContactName");
  assignString("emergencyContactPhone");
  assignString("emergencyContactRelation");
  assignString("allergies");
  assignString("chronicConditions");
  assignString("currentMedications");
  assignString("nationalId");
  assignString("insuranceProvider");
  assignString("insurancePolicyNumber");

  if (patch.gender !== undefined) data.gender = patch.gender;
  if (patch.bloodType !== undefined) data.bloodType = patch.bloodType;
  if (patch.dateOfBirth !== undefined) {
    data.dateOfBirth = patch.dateOfBirth === null ? null : new Date(patch.dateOfBirth);
  }

  return data;
}

/**
 * Translate Prisma errors thrown by a profile update into the project's
 * domain errors. Shared between the direct path and the verification flow so
 * both surface identical clean errors to the caller.
 */
export function mapProfileUpdateError(err: unknown): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    throw new ConflictError("This national ID is already registered to another account.");
  }
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2025"
  ) {
    throw new NotFoundError("User not found.");
  }
  throw err;
}

/**
 * Apply a profile patch via the global prisma client. Used by the
 * self-service profile editor and the doctor's medical-only edits (no code
 * required). The verification flow uses {@link buildProfileUpdateData} +
 * {@link mapProfileUpdateError} directly inside a transaction.
 */
export async function updateProfile(userId: string, patch: UpdateProfileInput) {
  const data = buildProfileUpdateData(patch);
  try {
    return await prisma.user.update({
      where: { id: userId },
      data,
      select: PROFILE_SELECT,
    });
  } catch (err) {
    mapProfileUpdateError(err);
  }
}
