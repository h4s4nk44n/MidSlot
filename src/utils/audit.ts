import { Request } from "express";
import { prisma } from "../lib/prisma";
import { AuditActionType } from "../types/audit";

// Keys whose values must be redacted before persisting metadata.
// Match is case-insensitive and applies recursively to nested objects.
const SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "hashedpassword",
  "newpassword",
  "oldpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "tokenhash",
  "secret",
  "apikey",
  "authorization",
];

const REDACTED = "[REDACTED]";

/**
 * Recursively walks a value and replaces sensitive fields with [REDACTED].
 * Arrays and nested objects are handled. Primitive values pass through.
 */
function stripSensitive(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map(stripSensitive);
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.includes(k.toLowerCase())) {
        out[k] = REDACTED;
      } else {
        out[k] = stripSensitive(v);
      }
    }
    return out;
  }

  return value;
}

/**
 * Extracts ip and user-agent from an Express Request.
 * Returns undefined fields when no request is available (e.g. system events).
 */
export function contextFromRequest(req?: Request): { ip?: string; userAgent?: string } {
  if (!req) return {};
  return {
    ip: req.ip,
    userAgent: req.headers["user-agent"]?.slice(0, 500),
  };
}

interface AuditLogInput {
  actorId?: string | null;
  action: AuditActionType;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

/**
 * Writes an audit log entry without blocking the caller.
 *
 * The DB insert runs on the next tick (setImmediate). If it fails, the
 * error is logged to stderr but never propagates — audit failures must
 * not break the request path.
 */
export function log(input: AuditLogInput): void {
  // Strip sensitive keys eagerly so we hold them in memory for as little
  // time as possible (in case logging itself is delayed).
  const safeMetadata = input.metadata
    ? (stripSensitive(input.metadata) as Record<string, unknown>)
    : undefined;

  setImmediate(async () => {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: input.actorId ?? null,
          action: input.action,
          targetType: input.targetType ?? null,
          targetId: input.targetId ?? null,
          metadata: safeMetadata as object | undefined,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
    } catch (err) {
      console.error("[audit] failed to write log entry", {
        action: input.action,
        actorId: input.actorId,
        error: err instanceof Error ? err.message : err,
      });
    }
  });
}

// Re-export so callers only need one import
export { stripSensitive };

// Default export as namespace-style API for the spec'd `audit.log(...)` shape
const audit = { log };
export default audit;