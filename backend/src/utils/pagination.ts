import { z } from "zod";
import { prisma } from "../lib/prisma";

/**
 * Shared pagination query schema.
 * page: 1-based page number (default 1)
 * pageSize: items per page (default 20, capped at 100)
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Minimal Prisma model delegate shape we rely on.
 * Accepts any delegate with findMany + count (all Prisma models satisfy this).
 * Args are typed loosely so every Prisma model matches structurally.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface PaginatableDelegate {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findMany: (args?: any) => Promise<any[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  count: (args?: any) => Promise<number>;
}

export interface PaginateOptions {
  where?: Record<string, unknown>;
  orderBy?: Record<string, unknown> | Array<Record<string, unknown>>;
  page: number;
  pageSize: number;
  include?: Record<string, unknown>;
  select?: Record<string, unknown>;
}

/**
 * Generic paginate() wrapper. Runs findMany + count in a single Prisma
 * transaction for efficiency, and returns a structured envelope.
 *
 * NOTE: do not pass both include and select — Prisma will reject it at runtime.
 */
export async function paginate<T>(
  model: PaginatableDelegate,
  opts: PaginateOptions,
): Promise<Paginated<T>> {
  const { where, orderBy, page, pageSize, include, select } = opts;
  const skip = (page - 1) * pageSize;

  const findManyArgs: Record<string, unknown> = {
    where,
    orderBy,
    skip,
    take: pageSize,
  };
  if (include) findManyArgs.include = include;
  if (select) findManyArgs.select = select;

  // findMany + count inside a single $transaction so the count and the
  // returned page observe a consistent database snapshot.
  const ops = [
    model.findMany(findManyArgs),
    model.count({ where }),
  ] as unknown as Parameters<typeof prisma.$transaction>[0];
  const [items, total] = (await prisma.$transaction(ops)) as unknown as [T[], number];

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
  };
}
