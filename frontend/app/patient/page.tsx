import Link from "next/link";

/**
 * Patient home — Updated to point to the new doctors flow (MEDI-55).
 */
export default function PatientHome() {
  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
          Patient · Home
        </p>
        <h1
          className="page-title font-display text-4xl font-normal text-text-primary"
          style={{ letterSpacing: "-0.02em" }}
        >
          Find care, <em>fast</em>.
        </h1>
        <p className="max-w-[60ch] text-md text-text-muted">
          Browse doctors by specialty, pick a time, get on with your week.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-surface-raised p-8 text-center shadow-xs">
        <h2 className="font-display text-lg font-medium text-text-primary">
          Ready to find a doctor?
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          The doctor browser is now available. Start searching and filtering.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            href="/patient/doctors"
            className="inline-flex h-[34px] items-center justify-center rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm font-medium text-text-primary no-underline transition-colors hover:bg-neutral-50"
          >
            Browse Doctors
          </Link>
        </div>
      </section>
    </div>
  );
}