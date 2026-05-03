import Link from "next/link";

export default function AdminHome() {
  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
          Admin · Roster
        </p>
        <h1
          className="page-title font-display text-4xl font-normal text-text-primary"
          style={{ letterSpacing: "-0.02em" }}
        >
          Govern the <em>roster</em>.
        </h1>
        <p className="max-w-[60ch] text-md text-text-muted">
          Users, specialties, assignments, audit trails. Everything in one table.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-surface-raised p-8 text-center shadow-xs">
        <h2 className="font-display text-lg font-medium text-text-primary">
          Admin tables land soon.
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          The users browser, assignment editor, and audit viewer arrive with the admin sprint.
        </p>
        <div className="mt-5 flex justify-center gap-3">
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