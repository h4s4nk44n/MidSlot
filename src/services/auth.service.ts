import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { RegisterInput, LoginInput } from "../validators/auth.validator";
import jwt from "jsonwebtoken";

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

export const loginUser = async (data: LoginInput) => {
  const { email, password } = data;

  // 1. Kullanıcıyı bul
  const user = await prisma.user.findUnique({ where: { email } });

  // 2. Kullanıcı yoksa veya şifre yanlışsa — aynı hata mesajı (security)
  if (!user) {
    const error = new Error("Invalid email or password") as any;
    error.statusCode = 401;
    throw error;
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    const error = new Error("Invalid email or password") as any;
    error.statusCode = 401;
    throw error;
  }

  // 3. JWT oluştur
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET as string,
    { expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"] },
  );

  // 4. Password olmadan döndür
  const { password: _, ...userWithoutPassword } = user;

  return {
    token,
    user: userWithoutPassword,
  };
};
