import { prisma } from "../lib/prisma";
import { Prisma, Role, AppointmentStatus } from "../generated/prisma";
import { BadRequestError, ForbiddenError, NotFoundError } from "../utils/errors";

/**
 * Ensures the given receptionist (by User.id) has an active assignment to the
 * doctor (by Doctor.id). Throws ForbiddenError otherwise.
 */
export const assertReceptionistAssignedToDoctor = async (
  receptionistUserId: string,
  doctorId: string,
): Promise<void> => {
  const assignment = await prisma.receptionistAssignment.findUnique({
    where: {
      receptionistId_doctorId: { receptionistId: receptionistUserId, doctorId },
    },
  });

  if (!assignment) {
    throw new ForbiddenError("You are not assigned to this doctor.");
  }
};

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
  await assertReceptionistAssignedToDoctor(receptionistUserId, doctorId);

  return prisma.appointment.findMany({
    where: { doctorId },
    include: {
      patient: { select: { id: true, name: true, email: true } },
      timeSlot: true,
    },
    orderBy: { timeSlot: { startTime: "asc" } },
  });
};

export const createSlotForDoctor = async (
  receptionistUserId: string,
  doctorId: string,
  input: { date: Date; startTime: string; endTime: string },
) => {
  await assertReceptionistAssignedToDoctor(receptionistUserId, doctorId);

  const start = new Date(input.startTime);
  const end = new Date(input.endTime);

  if (end <= start) {
    throw new BadRequestError("endTime must be after startTime.");
  }

  const overlapping = await prisma.timeSlot.findFirst({
    where: {
      doctorId,
      AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
    },
  });

  if (overlapping) {
    throw new BadRequestError("Time slot overlaps with an existing slot for this doctor.");
  }

  return prisma.timeSlot.create({
    data: {
      doctorId,
      date: input.date,
      startTime: start,
      endTime: end,
    },
  });
};

export const deleteSlotForDoctor = async (receptionistUserId: string, slotId: string) => {
  const slot = await prisma.timeSlot.findUnique({ where: { id: slotId } });
  if (!slot) {
    throw new NotFoundError("Time slot not found.");
  }

  await assertReceptionistAssignedToDoctor(receptionistUserId, slot.doctorId);

  if (slot.isBooked) {
    throw new BadRequestError("Cannot delete a slot that is already booked.");
  }

  await prisma.timeSlot.delete({ where: { id: slotId } });
  return { success: true };
};

export const bookAppointmentOnBehalf = async (
  receptionistUserId: string,
  input: { patientId: string; timeSlotId: string; notes?: string },
) => {
  const patient = await prisma.user.findUnique({ where: { id: input.patientId } });
  if (!patient || patient.role !== Role.PATIENT) {
    throw new BadRequestError("patientId must reference an existing PATIENT user.");
  }

  const slot = await prisma.timeSlot.findUnique({ where: { id: input.timeSlotId } });
  if (!slot) {
    throw new NotFoundError("Time slot not found.");
  }

  await assertReceptionistAssignedToDoctor(receptionistUserId, slot.doctorId);

  if (slot.isBooked) {
    throw new BadRequestError("This slot is already booked.");
  }

  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.create({
      data: {
        patientId: input.patientId,
        doctorId: slot.doctorId,
        timeSlotId: slot.id,
        notes: input.notes,
      },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        timeSlot: true,
      },
    });

    await tx.timeSlot.update({
      where: { id: slot.id },
      data: { isBooked: true },
    });

    return appointment;
  });
};

export const cancelAppointmentOnBehalf = async (
  receptionistUserId: string,
  appointmentId: string,
) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });
  if (!appointment) {
    throw new NotFoundError("Appointment not found.");
  }

  await assertReceptionistAssignedToDoctor(receptionistUserId, appointment.doctorId);

  if (appointment.status !== AppointmentStatus.BOOKED) {
    throw new BadRequestError("Only BOOKED appointments can be cancelled.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.CANCELLED },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        timeSlot: true,
      },
    });

    await tx.timeSlot.update({
      where: { id: appointment.timeSlotId },
      data: { isBooked: false },
    });

    return updated;
  });
};

export const listAppointmentsForReceptionist = async (
  receptionistUserId: string,
  filters: { status?: string; doctorId?: string; date?: string },
) => {
  const assignments = await prisma.receptionistAssignment.findMany({
    where: { receptionistId: receptionistUserId },
    select: { doctorId: true },
  });
  const assignedDoctorIds = assignments.map((a) => a.doctorId);

  let doctorIdsFilter = assignedDoctorIds;
  if (filters.doctorId) {
    if (!assignedDoctorIds.includes(filters.doctorId)) {
      throw new ForbiddenError("You are not assigned to this doctor.");
    }
    doctorIdsFilter = [filters.doctorId];
  }

  const where: Prisma.AppointmentWhereInput = {
    doctorId: { in: doctorIdsFilter },
  };

  if (filters.status) {
    const validStatuses = Object.values(AppointmentStatus);
    if (!validStatuses.includes(filters.status as AppointmentStatus)) {
      throw new BadRequestError(
        `Invalid status filter. Must be one of: ${validStatuses.join(", ")}.`,
      );
    }
    where.status = filters.status as AppointmentStatus;
  }

  if (filters.date) {
    const parsed = new Date(filters.date);
    if (isNaN(parsed.getTime())) {
      throw new BadRequestError("Invalid date filter.");
    }
    const dayStart = new Date(parsed);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    where.timeSlot = { startTime: { gte: dayStart, lt: dayEnd } };
  }

  return prisma.appointment.findMany({
    where,
    include: {
      patient: { select: { id: true, name: true, email: true } },
      doctor: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      timeSlot: true,
    },
    orderBy: { timeSlot: { startTime: "asc" } },
  });
};

export const listSlotsForDoctor = async (
  receptionistUserId: string,
  doctorId: string,
) => {
  await assertReceptionistAssignedToDoctor(receptionistUserId, doctorId);

  return prisma.timeSlot.findMany({
    where: { doctorId },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
};