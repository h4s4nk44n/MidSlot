import { forwardRef, type InputHTMLAttributes } from "react";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Inline error text. Renders red border + helper line below. */
  error?: string;
  /** Optional muted helper text, shown when there is no error. */
  hint?: string;
}

/**
 * Label-on-top input field. Matches DESIGN.md §4 Inputs:
 * - Label above, not placeholder
 * - 36px default height
 * - border-strong at rest, border-focus + shadow-focus on focus
 * - error state: danger-border + danger-fg helper
 */
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  function FormField({ label, error, hint, id, className, ...rest }, ref) {
    const inputId = id ?? rest.name;
    const helperId = inputId ? `${inputId}-helper` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-text-body"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? helperId : undefined}
          className={[
            "h-9 w-full rounded-md border bg-surface-raised px-3 text-sm text-text-primary",
            "transition-shadow",
            "placeholder:text-text-subtle",
            "focus:outline-none focus:shadow-focus",
            error
              ? "border-danger-border focus:border-danger-border"
              : "border-border-strong focus:border-border-focus",
            "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-text-muted",
            className ?? "",
          ].join(" ")}
          {...rest}
        />
        {(error || hint) && (
          <p
            id={helperId}
            className={`text-xs ${error ? "text-danger-fg" : "text-text-muted"}`}
          >
            {error ?? hint}
          </p>
        )}
      </div>
    );
  },
);