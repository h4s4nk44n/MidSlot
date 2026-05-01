"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthShell, AuthSwitchLink } from "@/components/auth/AuthShell";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { registerSchema } from "@/lib/auth-validation";
import { apiPost, ApiError } from "@/lib/api";

interface RegisterResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setFieldErrors({});
    setServerError(null);

    // Client-side validation — same rules as backend MEDI-43.
    const parsed = registerSchema.safeParse({
      name,
      email,
      password,
      role: "PATIENT",
    });

    if (!parsed.success) {
      const next: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "name" || field === "email" || field === "password") {
          // First error per field wins.
          if (!next[field]) next[field] = issue.message;
        }
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
          // Email already registered. Show inline on the email field.
          setFieldErrors({ email: "An account with this email already exists." });
        } else if (err.status === 429) {
          setServerError(
            "Too many attempts from your network. Please wait a moment and try again.",
          );
        } else if (err.status === 400) {
          // Backend validation rejected — show its message.
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

  return (
    <AuthShell
      eyebrow="Register · Step 1 of 1"
      title={
        <>
          Create your <em>account</em>.
        </>
      }
      subtitle="Patients sign up here. Doctors and receptionists are added by an administrator."
      topRight={
        <AuthSwitchLink prompt="Already have an account?" href="/login" cta="Sign in" />
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
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