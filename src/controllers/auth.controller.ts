import { Request, Response, NextFunction } from "express";
import { registerSchema } from "../validators/auth.validator";
import { registerUser } from "../services/auth.service";

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid input",
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const user = await registerUser(parsed.data);
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
};