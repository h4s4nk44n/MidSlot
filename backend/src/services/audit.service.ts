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
}

export const listAuditLogs = async (
  opts: ListAuditLogsOptions,
): Promise<Paginated<unknown>> => {
  const { page, pageSize, action, actorId, targetType, targetId, from, to } = opts;

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

  return paginate(prisma.auditLog, {
    where,
    orderBy: { createdAt: "desc" },
    page,
    pageSize,
    include: {
      actor: { select: { id: true, name: true, email: true, role: true } },
    },
  });
};