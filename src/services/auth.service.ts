import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { RegisterInput, LoginInput } from "../validators/auth.validator";
import { ConflictError, UnauthorisedError } from "../utils/errors";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h"; // Default 1 hour
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d"; // Default 7 days

// Helper to create JWT token
const createJWTToken = (userId: string, email: string, role: string) => {
  return jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET as string,
    { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
  );
};

// Helper to create refresh token
const createRefreshToken = async (userId: string) => {
  const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;
  const token = jwt.sign(
    { userId },
    refreshTokenSecret as string,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
  );

  // Calculate expiration date
  const payload = jwt.decode(token) as any;
  const expiresAt = new Date(payload.exp * 1000);

  // Store refresh token in database
  await prisma.refreshToken.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return token;
};

export const registerUser = async (data: RegisterInput) => {
  const { email, name, password, role } = data;

  // 1. Is email already registered?
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError("Email already registered");
  }

  // 2. Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // 3. Create user (and Doctor profile if role is DOCTOR)
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

  // 1. Find user
  const user = await prisma.user.findUnique({ where: { email } });

  // 2. If user does not exist or password is wrong — same error message (security)
  if (!user) {
    throw new UnauthorisedError("Invalid email or password");
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    throw new UnauthorisedError("Invalid email or password");
  }

  // 3. Create JWT token
  const token = createJWTToken(user.id, user.email, user.role);

  // 4. Create and save refresh token
  const refreshToken = await createRefreshToken(user.id);

  // 5. Return without password
  const { password: _, ...userWithoutPassword } = user;

  return {
    token,
    refreshToken,
    user: userWithoutPassword,
  };
};

export const refreshAccessToken = async (refreshToken: string) => {
  try {
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;
    
    // Verify refresh token signature (will throw if invalid)
    jwt.verify(refreshToken, refreshTokenSecret as string);

    // Check if refresh token exists in database and is valid
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      const error = new Error("Invalid or expired refresh token") as any;
      error.statusCode = 401;
      throw error;
    }

    // Create new access token
    const user = storedToken.user;
    const newAccessToken = createJWTToken(user.id, user.email, user.role);

    return {
      token: newAccessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  } catch (error) {
    const err = error as any;
    const statusCode = err.statusCode || 401;
    const message = err.message || "Failed to refresh token";
    const refreshError = new Error(message) as any;
    refreshError.statusCode = statusCode;
    throw refreshError;
  }
};

export const logoutUser = async (refreshToken: string) => {
  try {
    // Delete refresh token from database
    await prisma.refreshToken.delete({
      where: { token: refreshToken },
    });
    return { success: true };
  } catch (error) {
    // Token doesn't exist, that's okay for logout
    return { success: true };
  }
};