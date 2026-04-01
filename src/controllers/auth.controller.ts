import { Request, Response, NextFunction } from "express";
import { registerSchema, loginSchema } from "../validators/auth.validator";
import { registerUser, loginUser, refreshAccessToken, logoutUser } from "../services/auth.service";
import { BadRequestError } from "../utils/errors";

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new BadRequestError("Invalid input");
      return;
    }

    const user = await registerUser(parsed.data);
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new BadRequestError("This slot is already booked.");
      return;
    }

    const result = await loginUser(parsed.data);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new BadRequestError("Refresh token is required");
      return;
    }

    const result = await refreshAccessToken(refreshToken);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new BadRequestError("Refresh token is required");
      return;
    }

    await logoutUser(refreshToken);
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    next(error);
  }
};
