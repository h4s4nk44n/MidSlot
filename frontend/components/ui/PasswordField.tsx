"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { PASSWORD_RULES } from "@/lib/password-rules";

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  /** Inline error text — red border + helper line below. */
  error?: string;
  /** Muted helper text, shown when there is no error and no checklist. */
  hint?: string;
  /** Render the live requirements checklist below the field. */
  showRequirements?: boolean;
  /** Controlled value (required so the checklist can evaluate it). */
  value: string;
}

/**
 * Password input with a show/hide eye toggle and an optional live requirements
 * checklist — each rule turns green as the value satisfies it. Mirrors
 * {@link FormField}'s styling.
 */
export function PasswordField({
  label,
  error,
  hint,
  showRequirements = false,
  id,
  className,
  value,
  ...rest
}: PasswordFieldProps) {
  const reactId = useId();
  const inputId = id ?? rest.name ?? reactId;
  const helperId = `${inputId}-helper`;
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-text-body">
        {label}
      </label>

      <div className="relative">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? helperId : undefined}
          className={[
            "h-9 w-full rounded-md border bg-surface-raised pl-3 pr-10 text-sm text-text-primary",
            "transition-shadow placeholder:text-text-subtle",
            "focus:outline-none focus:shadow-focus",
            error
              ? "border-danger-border focus:border-danger-border"
              : "border-border-strong focus:border-border-focus",
            "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-text-muted",
            className ?? "",
          ].join(" ")}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-text-muted hover:text-text-primary focus:outline-none focus-visible:text-text-primary"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>

      {(error || hint) && (
        <p id={helperId} className={`text-xs ${error ? "text-danger-fg" : "text-text-muted"}`}>
          {error ?? hint}
        </p>
      )}

      {showRequirements && (
        <ul className="mt-1 space-y-1" aria-label="Password requirements">
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(value);
            return (
              <li
                key={rule.label}
                className={`flex items-center gap-1.5 text-xs transition-colors ${
                  ok ? "text-green-600" : "text-text-muted"
                }`}
              >
                <span
                  aria-hidden
                  className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center"
                >
                  {ok ? <CheckIcon /> : <DotIcon />}
                </span>
                {rule.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}
