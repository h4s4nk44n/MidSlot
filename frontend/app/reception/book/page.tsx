"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveDoctor } from "@/lib/active-doctor-context";
import { bookAppointmentOnBehalf } from "@/lib/receptionist-api";
import { ApiError } from "@/lib/api";
import { PatientTypeahead } from "@/components/reception/PatientTypeahead";
import { SlotPicker } from "@/components/reception/SlotPicker";
import { Button } from "@/components/ui/Button";
import type { PatientResult } from "@/lib/receptionist-api";
import type { TimeSlot } from "@/lib/types";

type Step = 1 | 2 | 3;

const STEPS = [
  { n: 1 as Step, label: "Patient" },
  { n: 2 as Step, label: "Slot" },
  { n: 3 as Step, label: "Confirm" },
];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ReceptionBookPage() {
  const router = useRouter();
  const { activeDoctor, hydrated } = useActiveDoctor();

  const [step, setStep] = useState<Step>(1);
  const [patient, setPatient] = useState<PatientResult | null>(null);
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [conflictSlot, setConflictSlot] = useState(false);

  // Guard: no active doctor → send home
  useEffect(() => {
    if (!hydrated) return;
    if (!activeDoctor) router.replace("/reception");
  }, [hydrated, activeDoctor, router]);

  if (!hydrated || !activeDoctor) return null;

  const canGoNext = step === 1 ? !!patient : step === 2 ? !!slot : false;

  function handleNext() {
    if (step < 3) setStep((s) => (s + 1) as Step);
  }

  function handleBack() {
    if (step > 1) {
      setStep((s) => (s - 1) as Step);
      setSubmitError(null);
      setConflictSlot(false);
    }
  }

  function handleDoctorSlotChange(s: TimeSlot) {
    setSlot(s);
    setConflictSlot(false);
  }

  async function handleSubmit() {
    if (!patient || !slot) return;
    setSubmitting(true);
    setSubmitError(null);
    setConflictSlot(false);
    try {
      const res = await bookAppointmentOnBehalf({
        patientId: patient.id,
        timeSlotId: slot.id,
        notes: notes.trim() || undefined,
      });
      router.push(`/reception/doctors/${activeDoctor!.id}`);
    } catch (err: any) {
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 409) {
        setConflictSlot(true);
        setSubmitError("This slot was just booked by someone else. Please pick another.");
      } else if (status === 403) {
        setSubmitError("You are not assigned to this doctor. Contact your administrator.");
      } else {
        setSubmitError(err.message || "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <header className="space-y-3">
        <button
          onClick={() => router.push("/reception")}
          className="font-mono text-xs uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
        >
          &larr; Back to doctors
        </button>
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-100 font-mono text-sm font-medium text-sage-700"
          >
            {getInitials(activeDoctor.user.name)}
          </div>
          <div>
            <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
              Reception · Booking on behalf of
            </p>
            <h1
              className="font-display text-3xl font-normal text-text-primary"
              style={{ letterSpacing: "-0.02em" }}
            >
              {activeDoctor.user.name}&apos;s <em>patient</em>.
            </h1>
          </div>
        </div>
      </header>

      {/* ── Step indicator ── */}
      <nav aria-label="Booking steps" className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const done = step > s.n;
          const active = step === s.n;
          return (
            <div key={s.n} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={[
                    "flex h-6 w-6 items-center justify-center rounded-full font-mono text-2xs font-medium",
                    done
                      ? "bg-primary-700 text-white"
                      : active
                      ? "border-2 border-primary-700 text-primary-700"
                      : "border border-border text-text-muted",
                  ].join(" ")}
                >
                  {done ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    s.n
                  )}
                </span>
                <span
                  className={`text-sm font-medium ${
                    active ? "text-text-primary" : done ? "text-primary-700" : "text-text-muted"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-8 ${done ? "bg-primary-300" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Step panels ── */}
      <div className="rounded-lg border border-border bg-surface-raised p-6 shadow-xs">

        {/* Step 1 — Patient search (MEDI-90) */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-normal text-text-primary" style={{ letterSpacing: "-0.015em" }}>
                Find the <em>patient</em>.
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                Search by name or email address. At least 2 characters required.
              </p>
            </div>
            <PatientTypeahead value={patient} onChange={setPatient} />
          </div>
        )}

        {/* Step 2 — Slot picker (MEDI-91) */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-normal text-text-primary" style={{ letterSpacing: "-0.015em" }}>
                Pick a <em>slot</em>.
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                Showing open slots for {activeDoctor.user.name}. Greyed slots are already taken.
              </p>
            </div>
            {conflictSlot && (
              <div className="rounded-md border border-warning-border bg-warning-bg px-3 py-2.5 text-sm text-warning-fg">
                The previously selected slot was booked. Please pick another.
              </div>
            )}
            <SlotPicker
              doctor={activeDoctor}
              selected={slot}
              onChange={handleDoctorSlotChange}
            />
          </div>
        )}

        {/* Step 3 — Confirm + notes (MEDI-92) */}
        {step === 3 && patient && slot && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-normal text-text-primary" style={{ letterSpacing: "-0.015em" }}>
                Confirm <em>booking</em>.
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                Review the details below, add any notes, then submit.
              </p>
            </div>

            {/* Summary card */}
            <dl className="divide-y divide-border rounded-md border border-border">
              <div className="flex items-start justify-between gap-4 px-4 py-3">
                <dt className="min-w-[90px] font-mono text-2xs font-medium uppercase tracking-widest text-text-muted">
                  Patient
                </dt>
                <dd className="text-right text-sm text-text-primary">
                  <span className="font-medium">{patient.name}</span>
                  <span className="block text-xs text-text-muted">{patient.email}</span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 px-4 py-3">
                <dt className="min-w-[90px] font-mono text-2xs font-medium uppercase tracking-widest text-text-muted">
                  Doctor
                </dt>
                <dd className="text-right text-sm text-text-primary">
                  <span className="font-medium">{activeDoctor.user.name}</span>
                  {activeDoctor.specialization && (
                    <span className="block text-xs text-text-muted">{activeDoctor.specialization}</span>
                  )}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 px-4 py-3">
                <dt className="min-w-[90px] font-mono text-2xs font-medium uppercase tracking-widest text-text-muted">
                  Date & time
                </dt>
                <dd className="text-right font-mono text-sm text-text-primary">
                  {formatDateTime(slot.startTime)}
                  <span className="block text-xs text-text-muted">
                    → {new Date(slot.endTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </dd>
              </div>
            </dl>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">
                Notes <span className="text-text-muted">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
                rows={3}
                maxLength={1000}
                placeholder="Reason for visit, special instructions…"
                className="w-full resize-none rounded-md border border-border p-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
              />
              <p className="mt-1 text-right font-mono text-2xs text-text-muted">
                {notes.length} / 1000
              </p>
            </div>

            {submitError && (
              <div className="rounded-md border border-danger-border bg-danger-bg px-3 py-2.5 text-sm text-danger-fg">
                {submitError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Navigation buttons ── */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 1 || submitting}
        >
          {step === 1 ? "Cancel" : "← Edit"}
        </Button>

        {step < 3 ? (
          <Button onClick={handleNext} disabled={!canGoNext}>
            Next →
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={submitting || conflictSlot}
          >
            Book appointment
          </Button>
        )}
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => p !== "Dr." && p !== "Dr");
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + (parts.length > 1 ? last : "")).toUpperCase();
}
