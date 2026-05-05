import Link from "next/link";
import type { ReactNode } from "react";

interface AuthShellProps {
  /** Small uppercase mono label above the title (e.g. "Sign in · Step 1 of 1"). */
  eyebrow?: string;
  /** Page title. Use <em> on one word for the italic accent. */
  title: ReactNode;
  /** Body copy below the title, ~1 sentence. */
  subtitle?: string;
  /** Top-right link prompt (e.g. "New to MediSlot?"). */
  topRight?: ReactNode;
  /** The form itself. */
  children: ReactNode;
  /** Footer content beneath the form (switch link, etc.). */
  footer?: ReactNode;
  /** Optional compliance strip at the bottom of the form column. */
  compliance?: ReactNode;
}

/**
 * Split-panel shell shared by /login, /register, and (later) password reset.
 * Mirrors design/reference/Login.html — editorial dark left panel +
 * warm-paper form panel on the right.
 */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  topRight,
  children,
  footer,
  compliance,
}: AuthShellProps) {
  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -my-12 grid min-h-screen w-screen grid-cols-1 lg:grid-cols-[1fr_560px]">
      {/* ==== LEFT — editorial dark panel ==== */}
      <aside className="auth-left relative hidden flex-col overflow-hidden px-14 py-10 text-white lg:flex">
        {/* gradient + grid overlays — declared in <style> below */}

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-2.5">
          <span
            aria-hidden
            className="relative block h-[22px] w-[22px] rounded-[5px] bg-white"
          >
            <span className="absolute left-[6px] top-[10px] h-[2px] w-[10px] rounded-[1px] bg-primary-900" />
            <span className="absolute left-[10px] top-[6px] h-[10px] w-[2px] rounded-[1px] bg-primary-900" />
          </span>
          <span
            className="font-display text-md font-medium"
            style={{ letterSpacing: "-0.015em" }}
          >
            Medi
            <em
              className="font-normal italic"
              style={{ color: "oklch(80% 0.05 248)" }}
            >
              Slot
            </em>
          </span>
        </div>

        {/* Headline block */}
        <div className="relative z-10 mt-auto">
          <p
            className="font-mono text-2xs uppercase"
            style={{
              letterSpacing: "0.18em",
              color: "oklch(82% 0.05 248)",
            }}
          >
            Scheduling, unhurried.
          </p>
          <h1
            className="my-5 max-w-[14ch] font-display font-normal"
            style={{
              fontSize: "64px",
              lineHeight: 0.95,
              letterSpacing: "-0.035em",
            }}
          >
            Every{" "}
            <em
              className="italic"
              style={{ color: "oklch(85% 0.06 165)", fontWeight: 400 }}
            >
              minute
            </em>{" "}
            of care, accounted for.
          </h1>
          <p
            className="max-w-[42ch] text-md"
            style={{ lineHeight: 1.55, color: "oklch(85% 0.03 248)" }}
          >
            MediSlot coordinates doctors, receptionists, and patients around
            one living schedule — so clinics run on rhythm, not on reminders.
          </p>
        </div>

        {/* Quote */}
        <div
          className="relative z-10 mt-12 max-w-[44ch] border-t pt-6"
          style={{ borderColor: "oklch(100% 0 0 / 0.12)" }}
        >
          <blockquote
            className="m-0 font-display italic"
            style={{
              fontSize: "var(--text-lg)",
              lineHeight: 1.4,
              fontWeight: 400,
              letterSpacing: "-0.005em",
            }}
          >
            “Our receptionists book in half the clicks. Cancellations dropped
            38% in the first quarter.”
          </blockquote>
          <cite
            className="mt-4 block font-mono not-italic uppercase"
            style={{
              fontSize: "var(--text-2xs)",
              letterSpacing: "0.12em",
              color: "oklch(75% 0.04 248)",
            }}
          >
            — Operations Lead · Riverside Medical Group
          </cite>
        </div>

        {/* Foot */}
        <div
          className="relative z-10 mt-auto flex items-center justify-between pt-12 font-mono uppercase"
          style={{
            fontSize: "var(--text-2xs)",
            letterSpacing: "0.1em",
            color: "oklch(70% 0.03 248)",
          }}
        >
          <span>v1.0.0 · MEDI-53</span>
          <span>© 2026 MediSlot</span>
        </div>
      </aside>

      {/* ==== RIGHT — form panel on warm paper ==== */}
      <section className="flex flex-col bg-surface-page px-6 py-10 lg:px-20">
        {topRight && (
          <div className="flex justify-end text-sm text-text-muted">
            {topRight}
          </div>
        )}

        <div className="my-auto w-full max-w-[420px]">
          {eyebrow && (
            <p
              className="mb-2.5 font-mono uppercase text-primary-600"
              style={{
                fontSize: "var(--text-2xs)",
                letterSpacing: "0.14em",
              }}
            >
              {eyebrow}
            </p>
          )}
          <h2
            className="font-display font-normal text-text-primary"
            style={{
              fontSize: "38px",
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              margin: "0 0 8px",
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mb-7 text-md text-text-muted">{subtitle}</p>
          )}

          {children}

          {compliance && <div className="mt-6">{compliance}</div>}

          {footer && (
            <p className="mt-7 text-center text-xs text-text-muted">
              {footer}
            </p>
          )}
        </div>

        {/* Legal */}
        <div className="mt-auto flex items-center justify-between border-t border-border pt-6 text-xs text-text-muted">
          <div>© 2026 MediSlot, Inc.</div>
          <div className="flex gap-[18px]">
            <Link href="#" className="text-text-body no-underline hover:text-text-primary">
              Terms
            </Link>
            <Link href="#" className="text-text-body no-underline hover:text-text-primary">
              Privacy
            </Link>
            <span className="text-text-body">
              Status ·{" "}
              <span style={{ color: "var(--color-success-fg)" }}>
                operational
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* Decorative overlays for the left panel — done as a real CSS layer
          so they don't pollute Tailwind utility scans. */}
      <style jsx>{`
        .auth-left {
          background: var(--color-primary-900);
        }
        .auth-left::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(
              ellipse 600px 400px at 80% 30%,
              oklch(35% 0.12 248 / 0.6),
              transparent 70%
            ),
            radial-gradient(
              ellipse 500px 300px at 10% 90%,
              oklch(42% 0.08 165 / 0.4),
              transparent 70%
            );
          pointer-events: none;
        }
        .auth-left::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(
              to right,
              oklch(100% 0 0 / 0.04) 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              oklch(100% 0 0 / 0.04) 1px,
              transparent 1px
            );
          background-size: 56px 56px;
          mask-image: radial-gradient(
            ellipse 80% 80% at 50% 50%,
            black,
            transparent
          );
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

/** Single-line "prompt + link" helper — used in the top-right or footer. */
export function AuthSwitchLink({
  prompt,
  href,
  cta,
}: {
  prompt: string;
  href: string;
  cta: string;
}) {
  return (
    <span className="text-sm">
      {prompt}{" "}
      <Link
        href={href}
        className="font-medium text-text-link no-underline hover:underline"
      >
        {cta}
      </Link>
    </span>
  );
}

/** HIPAA strip — looks good on login; we don't show it on register. */
export function ComplianceStrip() {
  return (
    <div className="flex items-center gap-4 rounded-md border border-border bg-neutral-50 px-3.5 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border bg-surface-raised text-primary-700">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M12 2L3 7v6c0 5 4 9 9 9s9-4 9-9V7l-9-5z" />
          <path
            d="M9 12l2 2 4-4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="text-xs text-text-body">
        <strong className="font-medium text-text-primary">
          HIPAA-aligned · SOC 2 Type II
        </strong>
        <br />
        Sessions are audited. PHI is encrypted at rest and in transit.
      </p>
    </div>
  );
}