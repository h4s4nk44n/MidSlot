import { z } from "zod/v4";

export const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name cannot be empty"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["DOCTOR", "PATIENT"]),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
