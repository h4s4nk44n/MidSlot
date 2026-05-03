import Link from "next/link";

export default function ReceptionHome() {
  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
          Reception · Today
        </p>
        <h1
          className="page-title font-display text-4xl font-normal text-text-primary"
          style={{ letterSpacing: "-0.02em" }}
        >
          Book on <em>behalf</em>.
        </h1>
        <p className="max-w-[60ch] text-md text-text-muted">
          Switch between assigned doctors, reserve slots, keep the phones moving.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-surface-raised p-8 text-center shadow-xs">
        <h2 className="font-display text-lg font-medium text-text-primary">
          Reception console lands soon.
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          The doctor switcher and booking-on-behalf flow arrive with the reception sprint.
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