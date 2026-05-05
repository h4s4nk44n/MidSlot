"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthShell, AuthSwitchLink } from "@/components/auth/AuthShell";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { registerSchema, REGISTER_GENDERS } from "@/lib/auth-validation";
import { apiPost, ApiError } from "@/lib/api";

interface RegisterResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

type FieldKey =
  | "name"
  | "email"
  | "password"
  | "phone"
  | "dateOfBirth"
  | "gender"
  | "nationalId";

const GENDER_LABEL: Record<(typeof REGISTER_GENDERS)[number], string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  UNDISCLOSED: "Prefer not to say",
};

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<(typeof REGISTER_GENDERS)[number]>("UNDISCLOSED");
  const [nationalId, setNationalId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setFieldErrors({});
    setServerError(null);

    const parsed = registerSchema.safeParse({
      name,
      email,
      password,
      role: "PATIENT",
      phone,
      dateOfBirth,
      gender,
      nationalId,
    });

    if (!parsed.success) {
      const next: Partial<Record<FieldKey, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as FieldKey | undefined;
        if (!field) continue;
        if (!next[field]) next[field] = issue.message;
      }
      setFieldErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      await apiPost<RegisterResponse>(
        "/auth/register",
        parsed.data,
        { _skipRefresh: true },
      );

      toast.success("Account created — sign in to continue.");
      router.replace("/login");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          // Email or national ID conflict — disambiguate by message text.
          if (/national id/i.test(err.message)) {
            setFieldErrors({ nationalId: err.message });
          } else {
            setFieldErrors({ email: "An account with this email already exists." });
          }
        } else if (err.status === 429) {
          setServerError(
            "Too many attempts from your network. Please wait a moment and try again.",
          );
        } else if (err.status === 400) {
          setServerError(err.message || "Some details look invalid. Please review.");
        } else {
          setServerError(err.message || "Sign-up failed. Please try again.");
        }
      } else {
        setServerError(
          "Sign-up failed. Please check your connection and try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AuthShell
      eyebrow="Register · Step 1 of 1"
      title={
        <>
          Create your <em>account</em>.
        </>
      }
      subtitle="Patients sign up here. Doctors and receptionists are added by an administrator. The contact, demographic and identity fields below are required so staff can reach you and verify your records."
      topRight={
        <AuthSwitchLink prompt="Already have an account?" href="/login" cta="Sign in" />
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
        <SectionHeading>Account</SectionHeading>

        <FormField
          name="name"
          type="text"
          label="Full name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
          disabled={submitting}
        />

        <FormField
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          disabled={submitting}
        />

        <FormField
          name="password"
          type="password"
          label="Password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          hint="At least 8 characters with one uppercase letter, one lowercase letter, and one digit."
          disabled={submitting}
        />

        <SectionHeading>Contact</SectionHeading>

        <FormField
          name="phone"
          type="tel"
          label="Phone number"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={fieldErrors.phone}
          hint="We send appointment confirmations and verification codes here."
          disabled={submitting}
        />

        <SectionHeading>Demographics</SectionHeading>

        <FormField
          name="dateOfBirth"
          type="date"
          label="Date of birth"
          required
          max={today}
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          error={fieldErrors.dateOfBirth}
          disabled={submitting}
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="register-gender"
            className="font-mono text-2xs font-medium uppercase tracking-widest text-text-muted"
          >
            Gender <span className="text-danger-fg">*</span>
          </label>
          <select
            id="register-gender"
            name="gender"
            value={gender}
            onChange={(e) =>
              setGender(e.target.value as (typeof REGISTER_GENDERS)[number])
            }
            disabled={submitting}
            className="h-[38px] rounded-md border border-border-strong bg-surface-raised px-2.5 text-sm text-text-body focus:border-primary-500 focus:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:bg-neutral-50"
          >
            {REGISTER_GENDERS.map((g) => (
              <option key={g} value={g}>
                {GENDER_LABEL[g]}
              </option>
            ))}
          </select>
          {fieldErrors.gender && (
            <p className="text-xs text-danger-fg">{fieldErrors.gender}</p>
          )}
        </div>

        <SectionHeading>Identity</SectionHeading>

        <FormField
          name="nationalId"
          type="text"
          label="National ID"
          required
          value={nationalId}
          onChange={(e) => setNationalId(e.target.value)}
          error={fieldErrors.nationalId}
          hint="Required for medical record verification. Insurance and medical history can be added later from your profile."
          disabled={submitting}
        />

        {serverError && (
          <div
            role="alert"
            className="rounded-md border border-danger-border bg-danger-bg px-3 py-2.5 text-xs text-danger-fg"
          >
            {serverError}
          </div>
        )}

        <Button type="submit" size="lg" loading={submitting} className="mt-2 w-full">
          {submitting ? "Creating account…" : "Create account"}
        </Button>

        <p className="mt-1 text-xs text-text-muted">
          By creating an account you agree to MediSlot&apos;s Terms of Service and
          Privacy Policy.
        </p>
      </form>
    </AuthShell>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
      {children}
    </p>
  );
}
