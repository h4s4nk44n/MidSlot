import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { RegisterInput, LoginInput } from "../validators/auth.validator";
import { ConflictError, UnauthorisedError, AccountLockedError } from "../utils/errors";
import { generateRawRefreshToken, hashRefreshToken } from "../utils/tokenHelpers";
import audit from "../utils/audit";
import { AuditAction } from "../types/audit";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// Pre-computed bcrypt hash used to neutralise the timing oracle on
// loginUser when the email doesn't exist. Hashing the supplied password
// against a real (but non-matching) hash makes the unknown-email branch take
// roughly the same wall-clock time as the bad-password branch. The value
// itself is never compared against any real account.
const DUMMY_BCRYPT_HASH =
  "$2b$10$abcdefghijklmnopqrstuuMh1bU0o2YJfmL9xN8xJZ7n3aFv8lN8a";

// ─── Helpers ────────────────────────────────────────────────────────────────

const createAccessToken = (userId: string, email: string, role: string): string => {
  // JWT_SECRET is asserted at startup by assertRequiredEnv() in src/index.ts
  return jwt.sign({ userId, email, role }, process.env.JWT_SECRET!, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
};

interface IssueRefreshArgs {
  userId: string;
  familyId?: string; // existing family on rotation; new one on login
  userAgent?: string;
  ip?: string;
}

/**
 * Generates a raw refresh token, stores its hash, returns both the raw token
 * and the DB row. Raw token goes to the cookie; hash stays in DB.
 */
const issueRefreshToken = async ({ userId, familyId, userAgent, ip }: IssueRefreshArgs) => {
  const rawToken = generateRawRefreshToken();
  const tokenHash = hashRefreshToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  const stored = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      familyId: familyId ?? crypto.randomUUID(),
      expiresAt,
      userAgent,
      ip,
    },
  });

  return { rawToken, stored };
};

// ─── Register ───────────────────────────────────────────────────────────────

export const registerUser = async (data: RegisterInput) => {
  const { email, name, password, role, phone, dateOfBirth, gender, nationalId } = data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError("Email already registered");
  }

  // National ID is unique across all users — surface a clean conflict early
  // instead of letting the DB throw a generic unique-violation. The validator
  // requires nationalId, but guard against undefined for defense-in-depth
  // (Prisma rejects findUnique with `where: { nationalId: undefined }`).
  if (nationalId) {
    const nidTaken = await prisma.user.findUnique({ where: { nationalId } });
    if (nidTaken) {
      throw new ConflictError("National ID already registered");
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const dob = new Date(dateOfBirth);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      role,
      phone,
      dateOfBirth: dob,
      gender,
      nationalId,
      // Doctors keep their own gender/DOB on the Doctor row too (used by the
      // patient-facing doctor browse). Mirror the signup values.
      ...(role === "DOCTOR" && {
        doctor: { create: { gender, dateOfBirth: dob } },
      }),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  return user;
};

// ─── Login ──────────────────────────────────────────────────────────────────

interface LoginContext {
  userAgent?: string;
  ip?: string;
}

export const loginUser = async (data: LoginInput, context: LoginContext = {}) => {
  const { email, password } = data;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Run a dummy bcrypt.compare so the unknown-email branch takes the same
    // wall-clock time as the bad-password branch. Prevents account
    // enumeration via timing analysis.
    await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
    audit.log({
      action: AuditAction.LOGIN_FAILED,
      metadata: { email, reason: "user_not_found" },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    throw new UnauthorisedError("Invalid email or password");
  }

  // Lockout check BEFORE password verification
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const retryAfterSeconds = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / 1000,
    );
    audit.log({
      actorId: user.id,
      action: AuditAction.LOGIN_LOCKED,
      targetType: "User",
      targetId: user.id,
      metadata: { email, reason: "account_locked", retryAfterSeconds },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    throw new AccountLockedError(
      "Account is temporarily locked due to too many failed login attempts",
      retryAfterSeconds,
    );
  }

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    const newAttempts = user.loginAttempts + 1;

    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: 0,
          lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
        },
      });
      audit.log({
        actorId: user.id,
        action: AuditAction.LOGIN_LOCKED,
        targetType: "User",
        targetId: user.id,
        metadata: {
          email,
          reason: "max_attempts_exceeded",
          lockoutDurationMs: LOCKOUT_DURATION_MS,
        },
        ip: context.ip,
        userAgent: context.userAgent,
      });
      throw new AccountLockedError(
        "Account is temporarily locked due to too many failed login attempts",
        Math.ceil(LOCKOUT_DURATION_MS / 1000),
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: newAttempts },
    });
    audit.log({
      actorId: user.id,
      action: AuditAction.LOGIN_FAILED,
      targetType: "User",
      targetId: user.id,
      metadata: { email, reason: "bad_password", attempts: newAttempts },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    throw new UnauthorisedError("Invalid email or password");
  }

  // Success — reset attempts/lockout
  if (user.loginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });
  }

  const accessToken = createAccessToken(user.id, user.email, user.role);

  // Fresh family on a new login
  const { rawToken: rawRefreshToken } = await issueRefreshToken({
    userId: user.id,
    userAgent: context.userAgent,
    ip: context.ip,
  });
  
  audit.log({
    actorId: user.id,
    action: AuditAction.LOGIN_SUCCESS,
    targetType: "User",
    targetId: user.id,
    metadata: { email, role: user.role },
    ip: context.ip,
    userAgent: context.userAgent,
  });

  const { password: _, loginAttempts: __, lockedUntil: ___, ...userSafe } = user;

  return {
    accessToken,
    rawRefreshToken,
    user: userSafe,
  };
};

// ─── Refresh (with rotation + reuse detection) ──────────────────────────────

export const rotateRefreshToken = async (
  presentedRawToken: string,
  context: LoginContext = {},
) => {
  const tokenHash = hashRefreshToken(presentedRawToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  // Unknown token → 401
  if (!stored) {
    throw new UnauthorisedError("Invalid refresh token");
  }

  // REUSE DETECTION: token was already revoked → kill the entire family
  // (rotated-then-presented = theft signal)
  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: {
        familyId: stored.familyId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    // TODO: hook into AuditLog once MEDI-46 lands (security event)
    throw new UnauthorisedError("Refresh token reuse detected; session revoked");
  }

  // Expired token → 401
  if (stored.expiresAt < new Date()) {
    throw new UnauthorisedError("Refresh token expired");
  }

  // Happy path: issue new pair, link old → new, revoke old
  const user = stored.user;
  const newAccessToken = createAccessToken(user.id, user.email, user.role);

  const { rawToken: newRawToken, stored: newStored } = await issueRefreshToken({
    userId: user.id,
    familyId: stored.familyId, // SAME family across rotation chain
    userAgent: context.userAgent,
    ip: context.ip,
  });

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: {
      revokedAt: new Date(),
      replacedById: newStored.id,
    },
  });

  return {
    accessToken: newAccessToken,
    rawRefreshToken: newRawToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };
};

// ─── Logout ─────────────────────────────────────────────────────────────────

export const logoutUser = async (presentedRawToken: string | undefined) => {
  // No token? Logout is idempotent — just succeed.
  if (!presentedRawToken) return;

  const tokenHash = hashRefreshToken(presentedRawToken);

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored) return; // unknown token; nothing to revoke

  // Already revoked? Don't trigger reuse detection here — logout is "I know
  // about this token and I want it gone". Still idempotent.
  if (stored.revokedAt) return;

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });
};