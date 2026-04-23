import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { RegisterInput, LoginInput } from "../validators/auth.validator";
import { ConflictError, UnauthorisedError, AccountLockedError } from "../utils/errors";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h"; // Default 1 hour
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d"; // Default 7 day

// Helper to create JWT token
const createJWTToken = (userId: string, email: string, role: string) => {
  return jwt.sign({ userId, email, role }, process.env.JWT_SECRET as string, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
};

// Helper to create refresh token
const createRefreshToken = async (userId: string) => {
  const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;
  const token = jwt.sign({ userId }, refreshTokenSecret as string, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

  // Calculate expiration date
  const payload = jwt.decode(token) as jwt.JwtPayload;
  const expiresAt = new Date(payload.exp! * 1000);

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

  // 2. Hashing the password
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

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const loginUser = async (data: LoginInput) => {
  const { email, password } = data;

  // 1. Find user
  const user = await prisma.user.findUnique({ where: { email } });

  // 2. If user does not exist or password is wrong — same error message (security)
  if (!user) {
    throw new UnauthorisedError("Invalid email or password");
  }

  // 3. Check lockout status BEFORE verifying password
  //    (Even a correct password must not bypass an active lock.)
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const retryAfterSeconds = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / 1000,
    );
    throw new AccountLockedError(
      "Account is temporarily locked due to too many failed login attempts",
      retryAfterSeconds,
    );
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    const newAttempts = user.loginAttempts + 1;

    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      // Lock the account and reset counter
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: 0,
          lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
        },
      });

      throw new AccountLockedError(
        "Account is temporarily locked due to too many failed login attempts",
        Math.ceil(LOCKOUT_DURATION_MS / 1000),
      );
    }
  // Not at limit yet, just increment
    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: newAttempts },
    });
    throw new UnauthorisedError("Invalid email or password");
  }
   // 4. Success — reset attempts & lockout
  if (user.loginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });
  }

  // 5. Create JWT token
  const token = createJWTToken(user.id, user.email, user.role);

  // 6. Create and save refresh token
  const refreshToken = await createRefreshToken(user.id);

  // 7. Return without password
    const { password: _, loginAttempts: __, lockedUntil: ___, ...userWithoutSensitiveFields } = user;

  return {
    token,
    refreshToken,
    user: userWithoutSensitiveFields, // like password
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
      throw new UnauthorisedError("Invalid or expired refresh token");
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
    if (error instanceof UnauthorisedError) {
      throw error;
    }
    throw new UnauthorisedError("Failed to refresh token");
  }
};

export const logoutUser = async (refreshToken: string) => {
  try {
    // Delete refresh token from database
    await prisma.refreshToken.delete({
      where: { token: refreshToken },
    });
    return { success: true };
  } catch (_error) {
    // Token doesn't exist, that's okay for logout
    return { success: true };
  }
};
