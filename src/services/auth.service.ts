import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { RegisterInput } from "../validators/auth.validator";

export const registerUser = async (data: RegisterInput) => {
  const { email, name, password, role } = data;

  // 1. Email zaten kayıtlı mı?
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const error = new Error("Email already registered") as any;
    error.statusCode = 409;
    throw error;
  }

  // 2. Şifreyi hashle
  const hashedPassword = await bcrypt.hash(password, 10);

  // 3. User oluştur (DOCTOR ise Doctor profili de)
  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      role,
      ...(role === "DOCTOR" && {
        doctor: {
          create: {},
        },
      }),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  return user;
};