import Link from "next/link";

export default function DoctorHome() {
  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
          Doctor · Today
        </p>
        <h1
          className="page-title font-display text-4xl font-normal text-text-primary"
          style={{ letterSpacing: "-0.02em" }}
        >
          Today&apos;s <em>schedule</em>.
        </h1>
        <p className="max-w-[60ch] text-md text-text-muted">
          Open slots, review the day&apos;s patients, close the loop on completed visits.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-surface-raised p-8 text-center shadow-xs">
        <h2 className="font-display text-lg font-medium text-text-primary">
          Doctor dashboard lands soon.
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          The schedule grid, availability editor, and patient list arrive with the doctor sprint.
        </p>
        <div className="mt-5 flex justify-center">
          <Link
            href="/"
            className="inline-flex h-[34px] items-center justify-center rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm font-medium text-text-primary no-underline transition-colors hover:bg-neutral-50"
          >
            Back to home
          </Link>
        </div>
      </section>
    </div>
  );
}