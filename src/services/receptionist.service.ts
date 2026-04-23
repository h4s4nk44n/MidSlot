import { prisma } from "../lib/prisma";
import { ForbiddenError } from "../utils/errors";

export const listAssignedDoctors = async (receptionistUserId: string) => {
  const assignments = await prisma.receptionistAssignment.findMany({
    where: { receptionistId: receptionistUserId },
    include: {
      doctor: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return assignments.map((a) => a.doctor);
};

export const listDoctorAppointments = async (receptionistUserId: string, doctorId: string) => {
  const assignment = await prisma.receptionistAssignment.findUnique({
    where: {
      receptionistId_doctorId: { receptionistId: receptionistUserId, doctorId },
    },
  });

  if (!assignment) {
    throw new ForbiddenError("You are not assigned to this doctor.");
  }

  return prisma.appointment.findMany({
    where: { doctorId },
    include: {
      patient: { select: { id: true, name: true, email: true } },
      timeSlot: true,
    },
    orderBy: { timeSlot: { startTime: "asc" } },
  });
};
