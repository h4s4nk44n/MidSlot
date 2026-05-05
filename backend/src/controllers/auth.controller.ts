import { Request, Response, NextFunction } from "express";
import { registerSchema, loginSchema } from "../validators/auth.validator";
import {
  registerUser,
  loginUser,
  rotateRefreshToken,
  logoutUser,
} from "../services/auth.service";
import { BadRequestError, UnauthorisedError } from "../utils/errors";
import {
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
  clearRefreshCookie,
} from "../utils/tokenHelpers";

const getRequestContext = (req: Request) => ({
  userAgent: req.headers["user-agent"]?.slice(0, 500),
  ip: req.ip,
});

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw new BadRequestError(firstIssue?.message || "Invalid input", {
        issues: parsed.error.issues,
      });
    }

    const user = await registerUser(parsed.data);
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw new BadRequestError(firstIssue?.message || "Invalid input");
    }

    const { accessToken, rawRefreshToken, user } = await loginUser(
      parsed.data,
      getRequestContext(req),
    );

    // Refresh token → cookie ONLY (never in response body)
    setRefreshCookie(res, rawRefreshToken);

    res.status(200).json({
      token: accessToken,
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const presented = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!presented || typeof presented !== "string") {
      throw new UnauthorisedError("Refresh token missing");
    }

    const { accessToken, rawRefreshToken, user } = await rotateRefreshToken(
      presented,
      getRequestContext(req),
    );

    // Rotate the cookie too
    setRefreshCookie(res, rawRefreshToken);

    res.status(200).json({
      token: accessToken,
      user,
    });
  } catch (error) {
    // On any refresh failure, clear the cookie so the client doesn't keep
    // retrying with a dead token
    clearRefreshCookie(res);
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const presented = req.cookies?.[REFRESH_COOKIE_NAME];

    await logoutUser(typeof presented === "string" ? presented : undefined);
    clearRefreshCookie(res);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};