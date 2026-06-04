"use client";

import { useState, type FormEvent } from "react";
import { AuthShell, AuthSwitchLink, ComplianceStrip } from "@/components/auth/AuthShell";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { forgotPasswordSchema } from "@/lib/auth-validation";
import { apiPost, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEmailError(undefined);
    setServerError(null);

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message);
      return;
    }

    setSubmitting(true);
    try {
      // The endpoint is anti-enumeration (always 200), so success just means
      // "we accepted the request" — never confirms the email exists.
      await apiPost("/auth/forgot-password", { email: parsed.data.email }, { _skipRefresh: true });
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setServerError("Too many requests. Please wait a moment and try again.");
      } else {
        setServerError("Couldn't send the reset email. Check your connection and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Reset password"
      title={
        <>
          Forgot your <em>password</em>?
        </>
      }
      subtitle="Enter your email and we'll send you a link to reset it."
      topRight={<AuthSwitchLink prompt="Remembered it?" href="/login" cta="Back to sign in" />}
      compliance={<ComplianceStrip />}
    >
      {sent ? (
        <div
          role="status"
          className="rounded-md border border-border-strong bg-surface-raised px-3 py-3 text-sm text-text-body"
        >
          If <strong>{email}</strong> is registered, a password reset link is on its way. The link is
          valid for one hour.
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
          <FormField
            name="email"
            type="email"
            label="Email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
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
            {submitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
