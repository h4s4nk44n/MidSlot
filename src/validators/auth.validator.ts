import { z } from "zod/v4";

// Common passwords — küçük harfe çevrilmiş, case-insensitive kontrol için
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
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one digit")
  .refine(
    (pw) => !COMMON_PASSWORDS.includes(pw.toLowerCase()),
    "Password is too common; choose a less predictable one",
  );

export const registerSchema = z
  .object({
    email: z.string().email("Invalid email format"),
    name: z.string().min(1, "Name cannot be empty"),
    password: strongPassword,
    role: z.enum(["DOCTOR", "PATIENT"]),
  })
  .refine(
    ({ password, name, email }) => {
      const pwLower = password.toLowerCase();

      // İsim kontrolü: ad/soyadın her parçası 3+ karakter ise şifrede geçmesin
      const nameParts = name
        .toLowerCase()
        .split(/\s+/)
        .filter((part) => part.length >= 3);
      if (nameParts.some((part) => pwLower.includes(part))) return false;

      // Email local-part kontrolü: 3+ karakterse şifrede geçmesin
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
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;