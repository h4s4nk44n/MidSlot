"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAssignedDoctors } from "@/lib/receptionist-api";
import { useActiveDoctor } from "@/lib/active-doctor-context";
import { ApiError } from "@/lib/api";
import type { DoctorMinimal } from "@/lib/types";

export default function ReceptionHome() {
  const router = useRouter();
  const { setActiveDoctor } = useActiveDoctor();

  const [doctors, setDoctors] = useState<DoctorMinimal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAssignedDoctors()
      .then((data) => {
        if (!cancelled) setDoctors(data);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? err.message
            : "Could not load your assigned doctors.";
        setError(msg);
        setDoctors([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handlePick(doctor: DoctorMinimal) {
    setActiveDoctor(doctor);
    router.push(`/reception/doctors/${doctor.id}`);
  }

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
          Pick a doctor to act on behalf of. The selection sticks across pages
          until you switch or sign out.
        </p>
      </header>

      <section>
        <h2 className="mb-4 font-display text-lg font-medium text-text-primary">
          Assigned doctors
          {doctors && doctors.length > 0 && (
            <span className="ml-2 inline-flex items-center rounded-sm bg-neutral-100 px-1.5 py-0.5 font-mono text-2xs font-medium text-text-muted">
              {doctors.length}
            </span>
          )}
        </h2>

        {/* Loading */}
        {doctors === null && !error && <DoctorGridSkeleton />}

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="rounded-md border border-danger-border bg-danger-bg px-3 py-2.5 text-xs text-danger-fg"
          >
            {error}
          </div>
        )}

        {/* Empty state */}
        {doctors && doctors.length === 0 && !error && <EmptyState />}

        {/* Grid */}
        {doctors && doctors.length > 0 && (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.map((d) => (
              <li key={d.id}>
                <DoctorCard doctor={d} onPick={() => handlePick(d)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ─── Sub-components ─── */

function DoctorCard({
  doctor,
  onPick,
}: {
  doctor: DoctorMinimal;
  onPick: () => void;
}) {
  const initials = getInitials(doctor.user.name);
  return (
    <button
      type="button"
      onClick={onPick}
      className="group relative w-full rounded-lg border border-border bg-surface-raised p-5 text-left shadow-xs transition-shadow hover:shadow-sm focus:outline-none focus-visible:shadow-focus"
    >
      <div className="flex items-start gap-4">
        {/* Sage avatar — DESIGN.md §3.1 sage = doctor identity. */}
        <div
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sage-100 font-mono text-sm font-medium text-sage-700"
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-md font-medium text-text-primary">
            {doctor.user.name}
          </p>
          {doctor.specialization && (
            <p className="mt-0.5 text-sm text-text-muted">
              {doctor.specialization}
            </p>
          )}
          <p className="mt-2 truncate font-mono text-2xs uppercase tracking-widest text-text-subtle">
            ID · {doctor.id.slice(0, 8)}
          </p>
        </div>
      </div>

      {doctor.bio && (
        <p className="mt-4 line-clamp-2 text-sm text-text-muted">
          {doctor.bio}
        </p>
      )}

      <span className="mt-4 inline-flex items-center gap-1.5 font-mono text-2xs font-medium uppercase tracking-widest text-primary-700 group-hover:underline">
        Act as this doctor
        <svg
          aria-hidden
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center rounded-lg border border-border bg-surface-raised px-8 py-10 text-center shadow-xs">
      <div className="max-w-md">
        <p className="font-mono text-2xs uppercase tracking-widest text-text-subtle">
          Empty · Reception
        </p>
        <h3
          className="mt-3 font-display text-2xl font-normal text-text-primary"
          style={{ letterSpacing: "-0.015em" }}
        >
          You have no doctors <em className="italic text-primary-700">assigned</em> yet.
        </h3>
        <p className="mt-3 text-sm text-text-muted">
          Contact your administrator to request access to a doctor&apos;s schedule.
        </p>
      </div>
    </div>
  );
}

function DoctorGridSkeleton() {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="rounded-lg border border-border bg-surface-raised p-5 shadow-xs"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-neutral-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-neutral-100" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-neutral-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  // "Dr. Ayşe Yılmaz" → "AY"; "Mehmet" → "M"
  const meaningful = parts.filter((p) => p.length > 0 && p !== "Dr." && p !== "Dr");
  const first = meaningful[0]?.[0] ?? "";
  const last = meaningful[meaningful.length - 1]?.[0] ?? "";
  return (first + (meaningful.length > 1 ? last : "")).toUpperCase();
}