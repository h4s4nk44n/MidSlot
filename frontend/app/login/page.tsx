"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, AuthSwitchLink, ComplianceStrip } from "@/components/auth/AuthShell";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { loginSchema, homeForRole } from "@/lib/auth-validation";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setFieldErrors({});
    setServerError(null);

    // Client-side validation — same rules as the backend.
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "email" || field === "password") {
          next[field] = issue.message;
        }
      }
      setFieldErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      const user = await login(parsed.data.email, parsed.data.password);
      router.replace(homeForRole(user.role));
    } catch (err) {
      if (err instanceof ApiError) {
        // Lockout (423) and rate-limit (429) get specific copy.
        if (err.status === 423) {
          setServerError(
            "This account is temporarily locked after too many failed attempts. Try again in 15 minutes.",
          );
        } else if (err.status === 429) {
          setServerError(
            "Too many sign-in attempts from your network. Please wait a moment and try again.",
          );
        } else if (err.status === 401) {
          setServerError("Invalid email or password.");
        } else {
          setServerError(err.message || "Sign-in failed. Please try again.");
        }
      } else {
        setServerError("Sign-in failed. Please check your connection and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Sign in · Step 1 of 1"
      title={
        <>
          Welcome <em>back</em>.
        </>
      }
      subtitle="Sign in to manage appointments, availability, and patients."
      topRight={<AuthSwitchLink prompt="New to MediSlot?" href="/register" cta="Create an account" />}
      compliance={<ComplianceStrip />}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
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
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
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
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}