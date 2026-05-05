import { prisma } from "../lib/prisma";
import { paginate, Paginated } from "../utils/pagination";

interface ListAuditLogsOptions {
  page: number;
  pageSize: number;
  action?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
  /**
   * HIGH-010: only callers who are themselves the founder admin may see other
   * actors' email addresses. Regular admins get the actor name + role only.
   */
  viewerIsFounder?: boolean;
}

interface AuditLogRow {
  id: string;
  action: string;
  actorId: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  actor: {
    id: string;
    name: string;
    role: string;
    email?: string;
  } | null;
}

export const listAuditLogs = async (
  opts: ListAuditLogsOptions,
): Promise<Paginated<AuditLogRow>> => {
  const { page, pageSize, action, actorId, targetType, targetId, from, to, viewerIsFounder } = opts;

  const where: Record<string, unknown> = {};

  if (action) where.action = action;
  if (actorId) where.actorId = actorId;
  if (targetType) where.targetType = targetType;
  if (targetId) where.targetId = targetId;

  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = new Date(from);
    if (to) range.lt = new Date(to);
    where.createdAt = range;
  }

  // HIGH-010: only the founder admin sees actor email. All other admins get
  // id/name/role — enough to investigate, not enough to contact actors out
  // of band.
  const actorSelect = viewerIsFounder
    ? { id: true, name: true, email: true, role: true }
    : { id: true, name: true, role: true };

  return paginate(prisma.auditLog, {
    where,
    orderBy: { createdAt: "desc" },
    page,
    pageSize,
    include: {
      actor: { select: actorSelect },
    },
  }) as unknown as Promise<Paginated<AuditLogRow>>;
};