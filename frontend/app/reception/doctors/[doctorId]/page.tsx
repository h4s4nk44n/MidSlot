"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useActiveDoctor } from "@/lib/active-doctor-context";

export default function DoctorAvailabilityPage() {
  const router = useRouter();
  const { activeDoctor, hydrated } = useActiveDoctor();
  const params = useParams<{ doctorId: string }>();

  // If someone deep-links here without picking a doctor first, send them
  // back to the reception home so they pick one.
  useEffect(() => {
    if (!hydrated) return;
    if (!activeDoctor || activeDoctor.id !== params.doctorId) {
      router.replace("/reception");
    }
  }, [hydrated, activeDoctor, params.doctorId, router]);

  if (!hydrated || !activeDoctor) {
    return null;
  }

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
          Reception · Acting on behalf
        </p>
        <h1
          className="page-title font-display text-4xl font-normal text-text-primary"
          style={{ letterSpacing: "-0.02em" }}
        >
          {activeDoctor.user.name}&apos;s <em>schedule</em>.
        </h1>
        {activeDoctor.specialization && (
          <p className="text-md text-text-muted">{activeDoctor.specialization}</p>
        )}
      </header>

      <section className="rounded-lg border border-border bg-surface-raised p-8 text-center shadow-xs">
        <p className="font-mono text-2xs uppercase tracking-widest text-text-subtle">
          Coming soon
        </p>
        <h2 className="mt-3 font-display text-lg font-medium text-text-primary">
          Availability editor &amp; booking flow
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          You&apos;ll manage this doctor&apos;s open slots and book on their behalf
          from this page once the reception sprint lands.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            href="/reception"
            className="inline-flex h-[34px] items-center justify-center rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm font-medium text-text-primary no-underline transition-colors hover:bg-neutral-50"
          >
            Back to doctors
          </Link>
        </div>
      </section>
    </div>
  );
}