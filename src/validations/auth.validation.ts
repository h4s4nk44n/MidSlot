import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email({ message: "Invalid email format" }),
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  role: z.enum(["DOCTOR", "PATIENT"], { message: "Role must be DOCTOR or PATIENT" }),
});

export const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email format" }),
  password: z.string().min(1, { message: "Password is required" }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
