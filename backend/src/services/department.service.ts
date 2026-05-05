import { prisma } from "../lib/prisma";
import { ConflictError, NotFoundError } from "../utils/errors";

export const listDepartments = async () => {
  return prisma.department.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, createdAt: true },
  });
};

export const createDepartment = async (name: string) => {
  const existing = await prisma.department.findUnique({ where: { name } });
  if (existing) {
    throw new ConflictError("A department with this name already exists.");
  }
  return prisma.department.create({
    data: { name },
    select: { id: true, name: true, createdAt: true },
  });
};

export const deleteDepartment = async (id: string) => {
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Department not found.");
  }
  await prisma.department.delete({ where: { id } });
  return { success: true };
};
