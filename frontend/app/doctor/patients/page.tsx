"use client";

/**
 * /doctor/patients — patients with an active appointment in the last/next
 * scheduled window. Each row opens a profile drawer where the doctor can:
 *   - read the full patient profile,
 *   - edit medical fields inline (no code), and
 *   - request a 6-digit code to edit any other field.
 *
 * Patients drop off the list 10 min after their appointment ends, matching
 * the backend assertActiveAppointment guard.
 */

import { useCallback, useEffect, useState } from "react";
import { apiGet, ApiError } from "@/lib/api";
import { UserProfileDrawer } from "@/components/profile/UserProfileDrawer";

interface ActivePatientRow {
  appointmentId: string;
  patient: { id: string; name: string; email: string };
  startTime: string;
  endTime: string;
}

function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay = start.toDateString() === end.toDateString();
  
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    
  const day = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  
  return sameDay
    ? `${day} · ${fmt(start)} – ${fmt(end)}`
    : `${start.toLocaleString("en-US")} – ${end.toLocaleString("en-US")}`;
}

export default function DoctorPatientsPage() {
  const [rows, setRows] = useState<ActivePatientRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);

  const fetchPatients = useCallback(async () => {
    setError(null);
    try {
      const res = await apiGet<ActivePatientRow[]>("/doctor/patients");
      setRows(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load patients.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
    // Auto-refresh every 60s so finished appointments drop off the list.
    const id = setInterval(fetchPatients, 60_000);
    return () => clearInterval(id);
  }, [fetchPatients]);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
          Doctor · Patients
        </p>
        <h1
          className="page-title font-display text-3xl font-normal text-text-primary"
          style={{ letterSpacing: "-0.015em" }}
        >
          Active <em>patients</em>
        </h1>
        <p className="max-w-[60ch] text-md text-text-muted">
          Patients with a current appointment. Access closes 10 minutes after the
          appointment ends. Medical edits save inline; other fields require a
          code sent to the patient&apos;s phone.
        </p>
      </header>

      {rows === null && !error && (
        <div className="rounded-md border border-border bg-surface-raised p-8">
          <div className="space-y-3">
            <div className="h-5 w-44 animate-pulse rounded bg-neutral-100" />
            <div className="h-4 w-72 animate-pulse rounded bg-neutral-100" />
            <div className="h-4 w-64 animate-pulse rounded bg-neutral-100" />
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-danger-border bg-danger-bg px-3 py-2.5 text-xs text-danger-fg"
        >
          {error}
        </div>
      )}

      {rows && rows.length === 0 && !error && (
        <div className="flex min-h-[40vh] items-center justify-center rounded-lg border border-border bg-surface-raised px-8 py-10 text-center">
          <div className="max-w-md">
            <p className="font-mono text-2xs uppercase tracking-widest text-text-subtle">
              Nothing scheduled · Now
            </p>
            <h3
              className="mt-3 font-display text-2xl font-normal text-text-primary"
              style={{ letterSpacing: "-0.015em" }}
            >
              No <em className="italic text-primary-700">active</em> patients right now.
            </h3>
            <p className="mt-3 text-sm text-text-muted">
              When an appointment starts, the patient will appear here for the
              duration of the slot plus 10 minutes.
            </p>
          </div>
        </div>
      )}

      {rows && rows.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.appointmentId}>
              <button
                type="button"
                onClick={() => setDrawerUserId(r.patient.id)}
                className="group w-full rounded-lg border border-border bg-surface-raised p-5 text-left shadow-xs transition-shadow hover:shadow-sm focus:outline-none focus-visible:shadow-focus"
              >
                <div className="flex items-start gap-4">
                  <div
                    aria-hidden
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-neutral-100 font-mono text-sm font-medium text-text-body"
                  >
                    {initials(r.patient.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-md font-medium text-text-primary">
                      {r.patient.name}
                    </p>
                    <p className="truncate font-mono text-xs text-text-muted">
                      {r.patient.email}
                    </p>
                    <p className="mt-2 font-mono text-2xs uppercase tracking-widest text-primary-700">
                      {formatRange(r.startTime, r.endTime)}
                    </p>
                  </div>
                </div>
                <span className="mt-4 inline-flex items-center gap-1.5 font-mono text-2xs font-medium uppercase tracking-widest text-primary-700 group-hover:underline">
                  Open profile
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
            </li>
          ))}
        </ul>
      )}

      {drawerUserId && (
        <UserProfileDrawer
          userId={drawerUserId}
          actor="doctor"
          onClose={() => setDrawerUserId(null)}
        />
      )}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
