import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

/**
 * Button per DESIGN.md §4:
 * - Primary: solid primary-700, one per view
 * - Secondary: 1px border, white fill
 * - Ghost: in-row utilities
 * Sizes: sm 28px, md 34px (default), lg 40px.
 * Loading: shows spinner, disables interaction, preserves layout width.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const sizeClasses: Record<Size, string> = {
    sm: "h-7 px-3 text-xs",
    md: "h-[34px] px-4 text-sm",
    lg: "h-10 px-5 text-sm",
  };

  const variantClasses: Record<Variant, string> = {
    primary:
      "bg-primary-700 text-white border border-primary-700 hover:bg-primary-800 active:bg-primary-900",
    secondary:
      "bg-surface-raised text-text-primary border border-border-strong hover:bg-neutral-50",
    ghost:
      "bg-transparent text-text-body border border-transparent hover:bg-neutral-100 hover:text-text-primary",
    outline:
      "bg-transparent text-text-primary border border-border-strong hover:bg-neutral-50",
  };

  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
        "focus:outline-none focus-visible:shadow-focus",
        "disabled:cursor-not-allowed disabled:opacity-60",
        sizeClasses[size],
        variantClasses[variant],
        className ?? "",
      ].join(" ")}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
        />
      )}
      <span>{children}</span>
    </button>
  );
}