import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { RegisterInput, LoginInput } from "../validators/auth.validator";
import jwt from "jsonwebtoken";
import { ConflictError, UnauthorisedError } from "../utils/errors";

export const registerUser = async (data: RegisterInput) => {
  const { email, name, password, role } = data;

  // 1. Is email already registered?
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError("Email already registered");
  }

  // 2. Hashing the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // 3. Create user (If it is doctor; then also create doctor profile)
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

  // 1. Find the user
  const user = await prisma.user.findUnique({ where: { email } });

  // 2. If user doesn't exist or wrong password (same error message)
  if (!user) {
    throw new UnauthorisedError("Invalid email or password");
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    throw new UnauthorisedError("Invalid email or password");
  }

  // 3. create JWT
  const token = jwt.sign(
  { userId: user.id, email: user.email, role: user.role },
  process.env.JWT_SECRET as string,
  { expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"] }
);

  // 4. return without password
  const { password: _, ...userWithoutPassword } = user;

  return {
    token,
    user: userWithoutPassword,
  };
};