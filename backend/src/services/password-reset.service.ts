import crypto from "crypto";
import * as bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import logger from "../lib/logger";
import { BadRequestError } from "../utils/errors";
import { getEmailProvider } from "../lib/email";
import { escapeHtml } from "../lib/email-format";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const BCRYPT_ROUNDS = 12;

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Issue a single-use, time-limited reset token and email the reset link — but
 * only if the email maps to an active user. Always resolves the same way so the
 * endpoint can't be used to enumerate accounts. Returns the raw token (handy
 * for tests/dev); the controller never exposes it.
 */
export async function requestPasswordReset(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return null;

  const rawToken = crypto.randomBytes(48).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const baseUrl = (process.env.APP_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
  const link = `${baseUrl}/reset-password?token=${rawToken}`;
  const subject = "Reset your MediSlot password";
  const text =
    `Hi ${user.name},\n\n` +
    `We received a request to reset your MediSlot password. Use this link within ` +
    `the next hour:\n${link}\n\n` +
    `If you didn't request this, you can safely ignore this email.\n\n— MediSlot`;
  const html =
    `<p>Hi ${escapeHtml(user.name)},</p>` +
    `<p>We received a request to reset your MediSlot password. This link is valid for one hour:</p>` +
    `<p><a href="${link}">${escapeHtml(link)}</a></p>` +
    `<p>If you didn't request this, you can safely ignore this email.</p>` +
    `<p>— MediSlot</p>`;

  try {
    await getEmailProvider().send({ to: user.email, subject, html, text });
    logger.info(
      { userId: user.id, provider: getEmailProvider().name },
      "[password-reset] reset link emailed",
    );
  } catch (err) {
    logger.warn({ err, userId: user.id }, "[password-reset] failed to send reset email");
  }

  return rawToken;
}

/**
 * Consume a reset token: validate it (exists, not used, not expired), set the
 * new password, mark all of the user's reset tokens used, and revoke their
 * refresh tokens so existing sessions can't continue. Throws BadRequestError
 * on an invalid / expired / used token.
 */
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new BadRequestError("Invalid or expired reset token.");
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { password: passwordHash } }),
    // Burn every unused reset token for this user (single-use guarantee).
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    // Revoke active sessions — a reset should log the attacker (and the user) out.
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  logger.info({ userId: record.userId }, "[password-reset] password reset; sessions revoked");
}
