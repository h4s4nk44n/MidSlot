"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

interface VerifyCodeModalProps {
  phoneHint: string;
  provider: string;
  expiresAt: string;
  onVerify: (
    code: string,
  ) => Promise<{ ok: true } | { ok: false; reason: string; attemptsLeft?: number }>;
  onCancel: () => void;
}

/**
 * Six-digit code prompt for receptionist/doctor profile edits. The actor enters
 * the code that was just delivered to the patient's phone (or, in this demo,
 * to the server console via the ConsoleSmsProvider).
 */
export function VerifyCodeModal({
  phoneHint,
  provider,
  expiresAt,
  onVerify,
  onCancel,
}: VerifyCodeModalProps) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const remainingMs = Math.max(0, new Date(expiresAt).getTime() - now);
  const remainingMins = Math.floor(remainingMs / 60000);
  const remainingSecs = Math.floor((remainingMs % 60000) / 1000);
  const expired = remainingMs === 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6 || expired) return;
    setSubmitting(true);
    setError(null);
    const result = await onVerify(code);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.reason);
      if (typeof result.attemptsLeft === "number") {
        setAttemptsLeft(result.attemptsLeft);
      }
      setCode("");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="verify-code-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: "oklch(20% 0.04 248 / 0.45)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[420px] rounded-lg border border-border bg-surface-raised shadow-overlay"
      >
        <div className="px-6 pt-5 pb-3">
          <h2
            id="verify-code-title"
            className="font-display text-xl font-normal text-text-primary"
            style={{ letterSpacing: "-0.01em" }}
          >
            Confirm with patient code
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            We sent a 6-digit code to{" "}
            <strong className="text-text-primary">{phoneHint}</strong>. Ask the patient
            to read it back.
          </p>
          <p className="mt-1 font-mono text-2xs uppercase tracking-widest text-text-subtle">
            via {provider}
          </p>
        </div>

        <div className="space-y-3 px-6 pb-5">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="block w-full rounded-md border border-border-strong bg-surface-raised px-3 py-2.5 text-center font-mono text-xl tracking-[0.6em] text-text-primary focus:outline-none focus-visible:shadow-focus"
          />

          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>
              {expired ? (
                <span className="text-danger-fg">Code expired. Request a new one.</span>
              ) : (
                <>
                  Expires in{" "}
                  <strong className="text-text-primary">
                    {remainingMins}:{remainingSecs.toString().padStart(2, "0")}
                  </strong>
                </>
              )}
            </span>
            {attemptsLeft !== null && (
              <span className="text-warning-fg">
                {attemptsLeft} attempt{attemptsLeft === 1 ? "" : "s"} left
              </span>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-xs text-danger-fg">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-neutral-50 px-6 py-3">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={code.length !== 6 || expired}
            loading={submitting}
          >
            Verify &amp; save
          </Button>
        </div>
      </form>
    </div>
  );
}
