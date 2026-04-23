import { prisma } from "../lib/prisma";
import { Role } from "../generated/prisma";
import { BadRequestError, ConflictError, NotFoundError } from "../utils/errors";

export const listUsers = async (role?: string) => {
  const where = role && Object.values(Role).includes(role as Role) ? { role: role as Role } : {};

  return prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

export const deleteUser = async (userId: string, currentUserId: string) => {
  if (userId === currentUserId) {
    throw new BadRequestError("You cannot delete your own account.");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError("User not found.");
  }

  await prisma.user.delete({ where: { id: userId } });
  return { success: true };
};

export const createAssignment = async (
  receptionistId: string,
  doctorId: string,
  assignedByUserId: string,
) => {
  const receptionist = await prisma.user.findUnique({ where: { id: receptionistId } });
  if (!receptionist || receptionist.role !== Role.RECEPTIONIST) {
    throw new BadRequestError("Receptionist not found or user is not a RECEPTIONIST.");
  }

  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) {
    throw new NotFoundError("Doctor not found.");
  }

  const existing = await prisma.receptionistAssignment.findUnique({
    where: {
      receptionistId_doctorId: { receptionistId, doctorId },
    },
  });
  if (existing) {
    throw new ConflictError("Assignment already exists.");
  }

  return prisma.receptionistAssignment.create({
    data: { receptionistId, doctorId, assignedByUserId },
  });
};

export const deleteAssignment = async (id: string) => {
  const existing = await prisma.receptionistAssignment.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Assignment not found.");
  }
  await prisma.receptionistAssignment.delete({ where: { id } });
  return { success: true };
};

export const listAssignments = async () => {
  return prisma.receptionistAssignment.findMany({
    include: {
      receptionist: {
        select: { id: true, name: true, email: true },
      },
      doctor: {
        select: {
          id: true,
          specialization: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });
};
