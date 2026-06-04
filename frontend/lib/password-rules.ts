export interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

/**
 * Live, checkable subset of the backend password policy (mirror of
 * lib/auth-validation.ts `strongPassword`). The backend additionally rejects
 * common passwords and passwords containing the user's name/email; those are
 * surfaced as a field error on submit rather than as a live bullet.
 */
export const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "One uppercase letter (A–Z)", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One lowercase letter (a–z)", test: (pw) => /[a-z]/.test(pw) },
  { label: "One number (0–9)", test: (pw) => /[0-9]/.test(pw) },
];

/** True once the value satisfies every rule shown in the checklist. */
export const passwordMeetsAllRules = (pw: string): boolean =>
  PASSWORD_RULES.every((rule) => rule.test(pw));
