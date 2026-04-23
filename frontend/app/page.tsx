import Link from "next/link";

/**
 * MediSlot home — "Clinical Quiet" aesthetic.
 * Serif display title with one italic accent word, muted subhead,
 * one primary action + one secondary. No hero image.
 */
export default function Home() {
  return (
    <div className="space-y-16">
      <section className="max-w-[68ch] space-y-6">
        <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
          MediSlot · Appointment platform
        </p>
        <h1
          className="page-title font-display text-5xl font-normal leading-none text-text-primary"
          style={{ letterSpacing: "-0.03em" }}
        >
          Scheduling that reads like a <em>chart</em>, not a checkout.
        </h1>
        <p className="text-md text-text-muted">
          Doctors publish availability. Receptionists book on behalf of assigned patients.
          Patients self-book. Admins manage the roster. Everyone sees the same, calm surface.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/doctors"
            className="inline-flex h-[34px] items-center justify-center rounded-md border border-primary-800 bg-primary-700 px-3.5 text-sm font-medium text-white no-underline transition-colors hover:bg-primary-800"
          >
            Find a doctor
          </Link>
          <Link
            href="/login"
            className="inline-flex h-[34px] items-center justify-center rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm font-medium text-text-primary no-underline transition-colors hover:bg-neutral-50"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Role strips — each is a panel with a chip label (DESIGN.md §3 signature detail). */}
      <section className="grid grid-cols-4 gap-4">
        {ROLES.map((r) => (
          <article
            key={r.role}
            className="relative rounded-lg border border-border bg-surface-raised p-5 shadow-xs"
          >
            <span className="pointer-events-none absolute left-3 top-3 font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
              Role · {r.role}
            </span>
            <div className="mt-6 space-y-2">
              <h2 className="font-display text-lg font-medium text-text-primary">
                {r.title}
              </h2>
              <p className="text-sm text-text-muted">{r.blurb}</p>
            </div>
          </article>
        ))}
      </section>

      {/* "Today at a glance" — mono data row, mirrors Doctor Dashboard KPI feel. */}
      <section className="rounded-lg border border-border bg-surface-raised">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="font-display text-lg font-medium text-text-primary">
              Platform <em className="italic text-primary-700">pulse</em>
            </h3>
            <p className="mt-1 font-mono text-2xs uppercase tracking-widest text-text-muted">
              Last sync · just now
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-l-[3px] border-success-border bg-success-bg px-2 py-[3px] font-mono text-2xs font-medium uppercase tracking-wider text-success-fg">
            <span
              aria-hidden
              className="inline-block h-[5px] w-[5px] rounded-full bg-current opacity-80"
            />
            Healthy
          </span>
        </header>
        <dl className="grid grid-cols-4 divide-x divide-border">
          {KPIS.map((k) => (
            <div key={k.label} className="px-5 py-6">
              <dt className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
                {k.label}
              </dt>
              <dd
                className="mt-2 font-display text-4xl font-normal text-text-primary"
                style={{ letterSpacing: "-0.02em" }}
              >
                {k.value}
              </dd>
              <p className="mt-1 text-xs text-text-muted">{k.sub}</p>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

const ROLES = [
  {
    role: "ADMIN",
    title: "Govern the roster",
    blurb: "Users, specialties, assignments, audit trails. Everything in one table.",
  },
  {
    role: "DOCTOR",
    title: "Publish availability",
    blurb: "Open slots, review the day's patients, close the loop on completed visits.",
  },
  {
    role: "RECEPTIONIST",
    title: "Book on behalf",
    blurb: "Switch between assigned doctors, reserve slots, keep the phones moving.",
  },
  {
    role: "PATIENT",
    title: "Find care, fast",
    blurb: "Browse by specialty, pick a time, get on with your week.",
  },
] as const;

const KPIS = [
  { label: "Appointments today", value: "148", sub: "+12 vs. yesterday" },
  { label: "Open slots", value: "342", sub: "across 24 doctors" },
  { label: "Avg. booking time", value: "42s", sub: "slot → confirm" },
  { label: "Cancellation rate", value: "3.1%", sub: "rolling 30d" },
];
