import bcrypt from "bcrypt";
import { randomInt } from "crypto";
import { prisma } from "../lib/prisma";
import { getSmsProvider } from "../lib/sms";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from "../utils/errors";
import {
  PROFILE_SELECT,
  buildProfileUpdateData,
  mapProfileUpdateError,
} from "./profile.service";
import type { UpdateProfileInput } from "../validations/profile.validation";
import type { Prisma } from "../generated/prisma";

type ProfilePayload = Prisma.UserGetPayload<{ select: typeof PROFILE_SELECT }>;

const CODE_TTL_MINUTES = 5;
const CODE_LENGTH_DIGITS = 6;

export type ProfileChangePurpose =
  | "profile_edit_by_receptionist"
  | "profile_edit_by_doctor";

/** Generate a zero-padded N-digit code using crypto.randomInt for uniformity. */
function generateCode(): string {
  const max = 10 ** CODE_LENGTH_DIGITS;
  return randomInt(0, max).toString().padStart(CODE_LENGTH_DIGITS, "0");
}

/** Last-4 mask of a phone for UI hints — never log the full number to clients. */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `…${digits.slice(-4)}`;
}

interface RequestCodeOptions {
  targetUserId: string;
  requesterId: string;
  purpose: ProfileChangePurpose;
  payload: UpdateProfileInput;
}

export interface RequestCodeResult {
  requestId: string;
  expiresAt: Date;
  phoneHint: string;
  provider: string;
}

/**
 * Stash a pending profile change and dispatch a confirmation code to the
 * patient's phone via the configured SmsProvider. The change is NOT applied
 * until {@link verifyCodeAndApply} succeeds.
 */
export async function requestProfileChange(
  opts: RequestCodeOptions,
): Promise<RequestCodeResult> {
  const target = await prisma.user.findUnique({
    where: { id: opts.targetUserId },
    // updatedAt snapshot is required for stale-payload detection on verify.
    select: { id: true, phone: true, role: true, updatedAt: true },
  });
  if (!target) throw new NotFoundError("Target user not found.");

  if (!target.phone) {
    throw new UnprocessableEntityError(
      "This user has no phone number on file. Ask an admin to add one before staff edits.",
    );
  }

  // Doctor flow only ever targets patients (controller already enforces this,
  // but guard here too in case the service is reused).
  if (opts.purpose === "profile_edit_by_doctor" && target.role !== "PATIENT") {
    throw new ForbiddenError("Doctors can only edit patient profiles.");
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 8);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  const record = await prisma.verificationCode.create({
    data: {
      targetUserId: opts.targetUserId,
      requesterId: opts.requesterId,
      purpose: opts.purpose,
      codeHash,
      payload: opts.payload as object,
      targetUpdatedAtSnapshot: target.updatedAt,
      expiresAt,
    },
    select: { id: true },
  });

  const sms = getSmsProvider();
  await sms.send(
    target.phone,
    `MediSlot verification code: ${code}. Expires in ${CODE_TTL_MINUTES} minutes.`,
  );

  return {
    requestId: record.id,
    expiresAt,
    phoneHint: maskPhone(target.phone),
    provider: sms.name,
  };
}

export type VerifyOutcome =
  | { ok: true; updated: ProfilePayload }
  | {
      ok: false;
      reason: "expired" | "consumed" | "max_attempts" | "wrong_code" | "stale";
      attemptsLeft: number;
    };

/**
 * Validate a code and, on success, apply the stashed payload to the target's
 * profile inside a single transaction. The verification record is marked
 * `consumedAt` and the user row is updated atomically — a crash between the
 * two cannot leave a code reusable, and a successful update cannot leave the
 * code unconsumed.
 *
 * Stale-payload protection: if the patient's `updatedAt` advanced between
 * request and verify (i.e. someone else edited the profile in the meantime),
 * we refuse with reason "stale" so a 5-minute-old payload can't silently
 * stomp newer changes.
 */
export async function verifyCodeAndApply(
  requestId: string,
  requesterId: string,
  code: string,
): Promise<VerifyOutcome> {
  const record = await prisma.verificationCode.findUnique({
    where: { id: requestId },
  });
  if (!record) throw new NotFoundError("Verification request not found.");

  // The actor finishing verification must be the same staff member who started
  // the request — prevents one staff member from completing another's edit.
  if (record.requesterId !== requesterId) {
    throw new ForbiddenError("This verification request belongs to a different staff member.");
  }

  if (record.consumedAt) {
    return { ok: false, reason: "consumed", attemptsLeft: 0 };
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired", attemptsLeft: 0 };
  }
  if (record.attempts >= record.maxAttempts) {
    return { ok: false, reason: "max_attempts", attemptsLeft: 0 };
  }

  const matches = await bcrypt.compare(code, record.codeHash);
  if (!matches) {
    const next = await prisma.verificationCode.update({
      where: { id: requestId },
      data: { attempts: { increment: 1 } },
      select: { attempts: true, maxAttempts: true },
    });
    return {
      ok: false,
      reason: next.attempts >= next.maxAttempts ? "max_attempts" : "wrong_code",
      attemptsLeft: Math.max(0, next.maxAttempts - next.attempts),
    };
  }

  const data = buildProfileUpdateData(record.payload as UpdateProfileInput);

  // Apply payload + mark consumed in one transaction. We re-read the target's
  // updatedAt inside the tx and compare against the snapshot taken at request
  // time. If the snapshot is missing (legacy code issued before this column
  // existed) we skip the stale check.
  type StaleSentinel = { stale: true };
  let result: StaleSentinel | ProfilePayload;
  try {
    result = await prisma.$transaction(async (tx) => {
      if (record.targetUpdatedAtSnapshot) {
        const current = await tx.user.findUnique({
          where: { id: record.targetUserId },
          select: { updatedAt: true },
        });
        if (!current) throw new NotFoundError("Target user not found.");
        if (current.updatedAt.getTime() !== record.targetUpdatedAtSnapshot.getTime()) {
          // Burn the code so it can't be retried — staff must request a new
          // one with the latest profile state in mind.
          await tx.verificationCode.update({
            where: { id: requestId },
            data: { consumedAt: new Date() },
          });
          return { stale: true } satisfies StaleSentinel;
        }
      }

      await tx.verificationCode.update({
        where: { id: requestId },
        data: { consumedAt: new Date() },
      });
      return tx.user.update({
        where: { id: record.targetUserId },
        data,
        select: PROFILE_SELECT,
      });
    });
  } catch (err) {
    mapProfileUpdateError(err);
  }

  if ("stale" in result) {
    return { ok: false, reason: "stale", attemptsLeft: 0 };
  }
  return { ok: true, updated: result };
}

/** Sanity check: caller may not edit their own profile via the staff flow. */
export function ensureNotSelfEdit(targetUserId: string, requesterId: string): void {
  if (targetUserId === requesterId) {
    throw new BadRequestError("Use the self-service profile editor for your own account.");
  }
}
