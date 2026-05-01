import { z } from "zod";

// Mirror of backend src/validators/auth.validator.ts.
// Keep these in sync — backend is the source of truth, this is the
// client-side mirror so users see errors immediately.

const COMMON_PASSWORDS = [
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty",
  "qwerty123",
  "abc12345",
  "letmein",
  "welcome",
  "welcome1",
  "admin",
  "admin123",
  "iloveyou",
  "monkey",
  "dragon",
];

const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one digit")
  .refine(
    (pw) => !COMMON_PASSWORDS.includes(pw.toLowerCase()),
    "This password is too common — choose something less predictable",
  );

export const registerSchema = z
  .object({
    email: z.string().email("Enter a valid email address"),
    name: z.string().min(1, "Name is required"),
    password: strongPassword,
    role: z.literal("PATIENT"), // self-registration is patient-only
  })
  .refine(
    ({ password, name, email }) => {
      const pwLower = password.toLowerCase();

      const nameParts = name
        .toLowerCase()
        .split(/\s+/)
        .filter((p) => p.length >= 3);
      if (nameParts.some((p) => pwLower.includes(p))) return false;

      const localPart = email.toLowerCase().split("@")[0];
      if (localPart.length >= 3 && pwLower.includes(localPart)) return false;

      return true;
    },
    {
      message: "Password must not contain your name or email",
      path: ["password"],
    },
  );

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Where to send a user after a successful login, based on their role.
 * Until the role-home pages exist, all roles land on `/`.
 */
export function homeForRole(role: string): string {
  switch (role) {
    case "PATIENT":
      return "/doctors";
    case "DOCTOR":
      return "/dashboard";
    case "RECEPTIONIST":
      return "/dashboard";
    case "ADMIN":
      return "/admin/users";
    default:
      return "/";
  }
}