import bcrypt from "bcrypt";
import { randomInt, createHash } from "crypto";
import { prisma } from "../lib/prisma";
import { getEmailProvider } from "../lib/email";
import { escapeHtml } from "../lib/email-format";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
} from "../utils/errors";
import { PROFILE_SELECT, buildProfileUpdateData, mapProfileUpdateError } from "./profile.service";
import type { UpdateProfileInput } from "../validations/profile.validation";
import type { Prisma } from "../generated/prisma";
import audit from "../utils/audit";
import { AuditAction } from "../types/audit";

type ProfilePayload = Prisma.UserGetPayload<{ select: typeof PROFILE_SELECT }>;

const CODE_TTL_MINUTES = 5;
const CODE_LENGTH_DIGITS = 6;
const CODE_BCRYPT_ROUNDS = 12; // HIGH-002

// CRIT-008: rate-limit windows for verification-code requests. Tracked in
// memory per process — adequate for single-instance deployments. Behind a load
// balancer move this to Redis (or a DB-backed counter on VerificationCode).
const CODE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 min
const CODE_MAX_PER_TARGET_EMAIL = 3; // 3 codes per email / 15 min
const CODE_MAX_PER_REQUESTER = 10; // 10 codes per staff member / 15 min
const CODE_MAX_PER_TARGET_USER = 3; // 3 codes per target user / 15 min
const CODE_RESEND_COOLDOWN_MS = 60 * 1000; // 1 min between sends to same target

interface CodeRateRecord {
  hits: number[]; // unix-ms timestamps within the rolling window
}
const codeRateState = new Map<string, CodeRateRecord>();

function bumpAndCheck(
  bucket: string,
  limit: number,
  now: number,
  windowMs: number,
): { allowed: boolean; oldestHitAt?: number } {
  const rec = codeRateState.get(bucket) ?? { hits: [] };
  // Drop expired hits.
  rec.hits = rec.hits.filter((t) => now - t < windowMs);
  if (rec.hits.length >= limit) {
    const oldest = rec.hits[0];
    codeRateState.set(bucket, rec);
    return { allowed: false, oldestHitAt: oldest };
  }
  rec.hits.push(now);
  codeRateState.set(bucket, rec);
  return { allowed: true };
}

function hashEmail(email: string): string {
  // Hash so the rate-limit key isn't a raw email address sitting in memory.
  return createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 32);
}

export type ProfileChangePurpose = "profile_edit_by_receptionist" | "profile_edit_by_doctor";

/** Generate a zero-padded N-digit code using crypto.randomInt for uniformity. */
function generateCode(): string {
  const max = 10 ** CODE_LENGTH_DIGITS;
  return randomInt(0, max).toString().padStart(CODE_LENGTH_DIGITS, "0");
}

/** Partially mask an email for UI hints — never expose the full address. */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***@${domain}`;
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
  emailHint: string;
  provider: string;
}

/**
 * Stash a pending profile change and email a confirmation code to the patient
 * via the configured email provider. The change is NOT applied until
 * {@link verifyCodeAndApply} succeeds.
 */
export async function requestProfileChange(opts: RequestCodeOptions): Promise<RequestCodeResult> {
  const target = await prisma.user.findUnique({
    where: { id: opts.targetUserId },
    // updatedAt snapshot is required for stale-payload detection on verify.
    select: { id: true, email: true, name: true, role: true, updatedAt: true },
  });
  if (!target) throw new NotFoundError("Target user not found.");

  // Doctor flow only ever targets patients (controller already enforces this,
  // but guard here too in case the service is reused).
  if (opts.purpose === "profile_edit_by_doctor" && target.role !== "PATIENT") {
    throw new ForbiddenError("Doctors can only edit patient profiles.");
  }

  // CRIT-008: per-email, per-target-user, per-requester rate limiting + a
  // 1-minute cooldown for resends to the same target. Audit-log every send.
  const now = Date.now();
  const emailKey = `email:${hashEmail(target.email)}`;
  const userKey = `user:${target.id}`;
  const requesterKey = `req:${opts.requesterId}`;

  // Resend cooldown
  const lastForUser = codeRateState.get(userKey)?.hits.slice(-1)[0];
  if (lastForUser && now - lastForUser < CODE_RESEND_COOLDOWN_MS) {
    throw new TooManyRequestsError(
      "Please wait before requesting another verification code for this user.",
      Math.ceil((CODE_RESEND_COOLDOWN_MS - (now - lastForUser)) / 1000),
    );
  }

  for (const [bucket, limit] of [
    [emailKey, CODE_MAX_PER_TARGET_EMAIL] as const,
    [userKey, CODE_MAX_PER_TARGET_USER] as const,
    [requesterKey, CODE_MAX_PER_REQUESTER] as const,
  ]) {
    const check = bumpAndCheck(bucket, limit, now, CODE_LIMIT_WINDOW_MS);
    if (!check.allowed) {
      const retryAfterMs = CODE_LIMIT_WINDOW_MS - (now - (check.oldestHitAt ?? now));
      throw new TooManyRequestsError(
        "Verification code rate limit reached. Please try again later.",
        Math.ceil(retryAfterMs / 1000),
      );
    }
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, CODE_BCRYPT_ROUNDS);
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

  const provider = getEmailProvider();
  const who = opts.purpose === "profile_edit_by_doctor" ? "Your doctor" : "A receptionist";
  const subject = "Your MediSlot verification code";
  const text =
    `Hi ${target.name},\n\n` +
    `${who} requested a change to your MediSlot profile. Share this 6-digit code ` +
    `with them to confirm:\n\n${code}\n\n` +
    `It expires in ${CODE_TTL_MINUTES} minutes. If you didn't expect this, do not ` +
    `share the code.\n\n— MediSlot`;
  const html =
    `<p>Hi ${escapeHtml(target.name)},</p>` +
    `<p>${who} requested a change to your MediSlot profile. Share this 6-digit code ` +
    `with them to confirm:</p>` +
    `<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>` +
    `<p>It expires in ${CODE_TTL_MINUTES} minutes. If you didn't expect this, do not ` +
    `share the code.</p><p>— MediSlot</p>`;
  await provider.send({ to: target.email, subject, html, text });

  // CRIT-008: audit each send so code-bombing or runaway cost is visible.
  // Note: we do NOT log the code or full email — only metadata about the send.
  audit.log({
    actorId: opts.requesterId,
    action: AuditAction.VERIFICATION_CODE_SEND,
    targetType: "User",
    targetId: target.id,
    metadata: {
      requestId: record.id,
      purpose: opts.purpose,
      emailHint: maskEmail(target.email),
      provider: provider.name,
    },
  });

  return {
    requestId: record.id,
    expiresAt,
    emailHint: maskEmail(target.email),
    provider: provider.name,
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
