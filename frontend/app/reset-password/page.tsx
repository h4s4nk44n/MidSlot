"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, AuthSwitchLink, ComplianceStrip } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/ui/PasswordField";
import { Button } from "@/components/ui/Button";
import { resetPasswordSchema } from "@/lib/auth-validation";
import { passwordMeetsAllRules } from "@/lib/password-rules";
import { apiPost, ApiError } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setServerError(null);

    if (!token) {
      setServerError("This reset link is missing its token. Request a new one.");
      return;
    }

    const next: { password?: string; confirm?: string } = {};
    const parsed = resetPasswordSchema.safeParse({ password });
    if (!parsed.success) next.password = parsed.error.issues[0]?.message;
    if (password !== confirm) next.confirm = "Passwords do not match";
    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      await apiPost("/auth/reset-password", { token, password }, { _skipRefresh: true });
      setDone(true);
      setTimeout(() => router.replace("/login"), 1500);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setServerError("This reset link is invalid or has expired. Request a new one.");
      } else if (err instanceof ApiError && err.status === 429) {
        setServerError("Too many attempts. Please wait a moment and try again.");
      } else {
        setServerError("Couldn't reset your password. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div
        role="status"
        className="rounded-md border border-border-strong bg-surface-raised px-3 py-3 text-sm text-text-body"
      >
        Your password has been reset. Redirecting you to sign in…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
      <PasswordField
        name="password"
        label="New password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        showRequirements
        disabled={submitting}
      />
      <PasswordField
        name="confirm"
        label="Confirm new password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={fieldErrors.confirm}
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

      <Button
        type="submit"
        size="lg"
        loading={submitting}
        disabled={!passwordMeetsAllRules(password) || password !== confirm}
        className="mt-2 w-full"
      >
        {submitting ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Reset password"
      title={
        <>
          Choose a new <em>password</em>.
        </>
      }
      subtitle="Set a new password for your MediSlot account."
      topRight={<AuthSwitchLink prompt="Remembered it?" href="/login" cta="Back to sign in" />}
      compliance={<ComplianceStrip />}
    >
      <Suspense fallback={<p className="text-sm text-text-body">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
