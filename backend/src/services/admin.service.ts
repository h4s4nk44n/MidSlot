import { prisma } from "../lib/prisma";
import { Role } from "../generated/prisma";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../utils/errors";
import { paginate, Paginated } from "../utils/pagination";

interface ListUsersOptions {
  role?: string;
  q?: string;
  active?: boolean;
  page: number;
  pageSize: number;
  /**
   * Role of the caller. ADMIN sees every user; everyone else sees no ADMINs
   * (per spec: "No one can see admins in any user section, only admins can
   * see other admins and themselves").
   */
  viewerRole: Role;
}

export const listUsers = async (
  opts: ListUsersOptions,
): Promise<Paginated<unknown>> => {
  const { role, q, active, page, pageSize, viewerRole } = opts;

  const where: Record<string, unknown> = {};
  if (role && Object.values(Role).includes(role as Role)) {
    where.role = role as Role;
  }
  if (typeof active === "boolean") {
    where.isActive = active;
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (viewerRole !== Role.ADMIN) {
    // Non-admins cannot see admins — overrides any explicit role filter.
    where.role = role && (role as Role) !== Role.ADMIN ? (role as Role) : { not: Role.ADMIN };
  }

  return paginate(prisma.user, {
    where,
    orderBy: { createdAt: "desc" },
    page,
    pageSize,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      isFounder: true,
      createdAt: true,
      doctor: {
        select: {
          title: true,
          specialization: true,
          gender: true,
          dateOfBirth: true,
        },
      },
    },
  });
};

/**
 * Single-user fetch for the admin/receptionist details drawer. Returns every
 * column the staff drawer needs (patient profile + doctor profile if any) so
 * the UI can render in one round-trip.
 *
 * Non-admin viewers cannot fetch admin records (treated as 404 to avoid
 * leaking the existence of the admin via an explicit 403).
 */
export const getUserDetails = async (id: string, viewerRole: Role) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      isFounder: true,
      createdAt: true,
      updatedAt: true,
      // Patient profile fields (also meaningful on staff users — they may
      // have their own contact info filled in)
      phone: true,
      dateOfBirth: true,
      gender: true,
      address: true,
      city: true,
      country: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      emergencyContactRelation: true,
      bloodType: true,
      allergies: true,
      chronicConditions: true,
      currentMedications: true,
      nationalId: true,
      insuranceProvider: true,
      insurancePolicyNumber: true,
      doctor: {
        select: {
          id: true,
          title: true,
          specialization: true,
          bio: true,
          gender: true,
          dateOfBirth: true,
        },
      },
    },
  });
  if (!user) throw new NotFoundError("User not found.");
  if (user.role === Role.ADMIN && viewerRole !== Role.ADMIN) {
    throw new NotFoundError("User not found.");
  }
  return user;
};

interface UpdateUserOptions {
  role?: Role;
  isActive?: boolean;
  title?: string;
  specialization?: string;
  gender?: "MALE" | "FEMALE" | "OTHER" | "UNDISCLOSED";
  dateOfBirth?: string | null;
}

/**
 * Update a user's role and/or active flag.
 *
 * Policy:
 *  - Admins cannot change their own role at all (use transferAdmin instead).
 *  - Admins cannot deactivate themselves.
 *  - The founder admin is immutable: nobody else can change their role,
 *    deactivate them, or otherwise alter them through this path.
 *  - Granting/revoking the ADMIN role is allowed via this path *only* for
 *    non-founder targets, and the frontend funnels those through dedicated
 *    confirmation dialogs.
 */
export const updateUser = async (
  userId: string,
  currentUserId: string,
  patch: UpdateUserOptions,
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError("User not found.");
  }

  if (userId === currentUserId) {
    if (patch.role !== undefined && patch.role !== user.role) {
      throw new BadRequestError(
        "You cannot change your own role. Use transfer admin to hand it off.",
      );
    }
    if (patch.isActive === false) {
      throw new BadRequestError("You cannot deactivate your own account.");
    }
  }

  // Founder is fully immutable from any other admin — no field on `patch` is
  // accepted. The founder can still edit their own non-role/isActive fields
  // (handled by the self-edit branch above).
  if (user.isFounder && userId !== currentUserId) {
    throw new ForbiddenError("The founder admin cannot be modified.");
  }

  const data: Record<string, unknown> = {};
  if (patch.role !== undefined) data.role = patch.role;
  if (patch.isActive !== undefined) data.isActive = patch.isActive;

  // Title, specialization, gender and dateOfBirth only apply when the user is
  // (or is being made) a DOCTOR. Upsert the Doctor row in the same transaction
  // so promotion + profile field set happens in a single PATCH.
  const effectiveRole = patch.role ?? user.role;
  const shouldTouchDoctor =
    effectiveRole === Role.DOCTOR &&
    (patch.title !== undefined ||
      patch.specialization !== undefined ||
      patch.gender !== undefined ||
      patch.dateOfBirth !== undefined ||
      patch.role === Role.DOCTOR);

  const dobValue =
    patch.dateOfBirth === undefined
      ? undefined
      : patch.dateOfBirth === null
        ? null
        : new Date(patch.dateOfBirth);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (shouldTouchDoctor) {
      await tx.doctor.upsert({
        where: { userId },
        create: {
          userId,
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.specialization !== undefined
            ? { specialization: patch.specialization }
            : {}),
          ...(patch.gender !== undefined ? { gender: patch.gender } : {}),
          ...(dobValue !== undefined ? { dateOfBirth: dobValue } : {}),
        },
        update: {
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.specialization !== undefined
            ? { specialization: patch.specialization }
            : {}),
          ...(patch.gender !== undefined ? { gender: patch.gender } : {}),
          ...(dobValue !== undefined ? { dateOfBirth: dobValue } : {}),
        },
      });
    }

    const doctor =
      effectiveRole === Role.DOCTOR
        ? await tx.doctor.findUnique({
            where: { userId },
            select: {
              title: true,
              specialization: true,
              gender: true,
              dateOfBirth: true,
            },
          })
        : null;

    return { ...updated, doctor };
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
  if (user.isFounder) {
    throw new ForbiddenError("The founder admin cannot be deleted.");
  }

  await prisma.user.delete({ where: { id: userId } });
  return { success: true };
};

// ────────────────────────── Admin role lifecycle ──────────────────────────

/**
 * Promote a non-admin user to ADMIN. Frontend always confirms before calling.
 * The new admin is *not* a founder.
 */
export const grantAdmin = async (targetUserId: string, currentUserId: string) => {
  if (targetUserId === currentUserId) {
    throw new BadRequestError("You are already an admin.");
  }
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new NotFoundError("User not found.");
  if (target.role === Role.ADMIN) {
    throw new ConflictError("User is already an admin.");
  }
  return prisma.user.update({
    where: { id: targetUserId },
    data: { role: Role.ADMIN },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      isFounder: true,
      createdAt: true,
    },
  });
};

/**
 * Demote an admin back to PATIENT. The founder admin and the caller themself
 * are off-limits.
 */
export const revokeAdmin = async (targetUserId: string, currentUserId: string) => {
  if (targetUserId === currentUserId) {
    throw new BadRequestError(
      "You cannot revoke your own admin. Use transfer admin to hand it off.",
    );
  }
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new NotFoundError("User not found.");
  if (target.role !== Role.ADMIN) {
    throw new BadRequestError("User is not an admin.");
  }
  if (target.isFounder) {
    throw new ForbiddenError("The founder admin cannot be revoked.");
  }
  return prisma.user.update({
    where: { id: targetUserId },
    data: { role: Role.PATIENT },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      isFounder: true,
      createdAt: true,
    },
  });
};

/**
 * Transfer admin from the caller to another user. The previous admin becomes
 * a normal PATIENT account. Founder admins cannot transfer (they are
 * permanently admin per spec).
 */
export const transferAdmin = async (newAdminUserId: string, currentUserId: string) => {
  if (newAdminUserId === currentUserId) {
    throw new BadRequestError("Pick a different user to transfer admin to.");
  }
  const me = await prisma.user.findUnique({ where: { id: currentUserId } });
  if (!me) throw new NotFoundError("Current user not found.");
  if (me.role !== Role.ADMIN) {
    throw new ForbiddenError("Only admins can transfer admin.");
  }
  if (me.isFounder) {
    throw new ForbiddenError("The founder admin cannot transfer their role.");
  }
  const target = await prisma.user.findUnique({ where: { id: newAdminUserId } });
  if (!target) throw new NotFoundError("Target user not found.");
  if (target.role === Role.ADMIN) {
    throw new ConflictError("Target is already an admin.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: currentUserId },
      data: { role: Role.PATIENT },
    });
    return tx.user.update({
      where: { id: newAdminUserId },
      data: { role: Role.ADMIN },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isFounder: true,
        createdAt: true,
      },
    });
  });
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
          title: true,
          specialization: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });
};
