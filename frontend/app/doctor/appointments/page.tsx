"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost, apiPut, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Paginated } from "@/lib/types";

const NOTE_MAX_LENGTH = 4000;

type AppointmentStatus = "BOOKED" | "CANCELLED" | "COMPLETED";
type TabType = "upcoming" | "completed" | "cancelled";

const ACTIVE_WINDOW_BUFFER_MS = 10 * 60 * 1000;

interface Appointment {
  id: string;
  status: AppointmentStatus;
  notes: string | null;
  doctorNote: string | null;
  startedAt: string | null;
  endedAt: string | null;
  patient: {
    name: string;
    email: string;
  };
  timeSlot: {
    date: string;
    startTime: string;
    endTime: string;
  };
}

interface DoctorNoteEditorProps {
  appointmentId: string;
  initialNote: string | null;
  endTime: string;
  startedAt: string | null;
  endedAt: string | null;
  status: AppointmentStatus;
  onSaved: () => void;
}

function DoctorNoteEditor({
  appointmentId,
  initialNote,
  endTime,
  startedAt,
  endedAt,
  status,
  onSaved,
}: DoctorNoteEditorProps) {
  const [note, setNote] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);
  // Re-render every 30s so the active window flips automatically as time passes.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setNote(initialNote ?? "");
  }, [initialNote]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Editable iff: doctor has started the session AND we're inside the
  // (endedAt ?? slot.endTime) + 10min window. status must still be BOOKED
  // OR just turned COMPLETED (endedAt set) — but the backend gates on
  // status === BOOKED, so once ended the editor falls back to read-only.
  const referenceEnd = endedAt ? new Date(endedAt) : new Date(endTime);
  const windowEnd = new Date(referenceEnd.getTime() + ACTIVE_WINDOW_BUFFER_MS);
  const isActive = !!startedAt && status === "BOOKED" && now <= windowEnd;
  const dirty = (note ?? "").trim() !== (initialNote ?? "").trim();

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPut(`/doctor/appointments/${appointmentId}/note`, { note });
      toast.success("Note saved.");
      onSaved();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to save the note.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!isActive) {
    if (!initialNote) {
      // No note + outside window — nothing useful to show.
      if (status === "BOOKED") {
        return (
          <div className="mt-3 rounded-md border border-dashed border-border bg-surface-base p-3 text-xs text-text-muted">
            {startedAt
              ? "The 10-minute note window has closed."
              : "Start the appointment to write a clinical note (editable until 10 minutes after the visit ends)."}
          </div>
        );
      }
      return null;
    }
    return (
      <div className="mt-3 rounded-md border border-border bg-surface-raised p-3">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-text-muted">
          Doctor note
        </div>
        <p className="whitespace-pre-wrap text-sm text-text-body">{initialNote}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-border bg-surface-raised p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
          Doctor note
        </div>
        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
          Active window
        </span>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX_LENGTH))}
        rows={4}
        placeholder="Write a note about this visit (visible to the patient and other staff)…"
        className="w-full resize-y rounded-md border border-border bg-surface-base p-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        disabled={saving}
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-muted">
          {note.length}/{NOTE_MAX_LENGTH}
        </span>
        <Button
          size="sm"
          onClick={handleSave}
          loading={saving}
          disabled={!dirty}
        >
          Save note
        </Button>
      </div>
    </div>
  );
}

export default function DoctorAppointmentsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("upcoming");
  const [appointments, setAppointments] = useState<Paginated<Appointment> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Force backend to filter by status based on the selected tab
      let statusQuery = "";
      if (activeTab === "upcoming") statusQuery = "&status=BOOKED";
      if (activeTab === "completed") statusQuery = "&status=COMPLETED";
      if (activeTab === "cancelled") statusQuery = "&status=CANCELLED";

      let res;
      try {
        res = await apiGet<Paginated<Appointment>>(
          `/appointments/me?page=${page}&pageSize=10&tab=${activeTab}${statusQuery}`
        );
      } catch (firstErr: any) {
        if (firstErr.status === 404) {
          res = await apiGet<Paginated<Appointment>>(
            `/appointments?page=${page}&pageSize=10&tab=${activeTab}${statusQuery}`
          );
        } else {
          throw firstErr;
        }
      }
      setAppointments(res);
    } catch (err: any) {
      setError(err.message || "Failed to load appointments.");
    } finally {
      setLoading(false);
    }
  }, [page, activeTab]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // --- Actions ---
  const handleCancel = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this appointment?")) return;

    setActionId(id);
    try {
      await apiPatch(`/appointments/${id}/cancel`);
      fetchAppointments();
    } catch (err: any) {
      alert(err.message || "Failed to cancel the appointment.");
    } finally {
      setActionId(null);
    }
  };

  /** Open the in-person session: POSTs /start (idempotent) then routes to the session page. */
  const handleStart = async (id: string) => {
    setActionId(id);
    try {
      await apiPost(`/doctor/appointments/${id}/start`);
      router.push(`/doctor/appointments/${id}/session`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to start the appointment.";
      toast.error(msg);
    } finally {
      setActionId(null);
    }
  };

  /** End an already-started session — flips to COMPLETED and stamps endedAt. */
  const handleEnd = async (id: string) => {
    if (!window.confirm("End this appointment? It will be marked completed.")) return;
    setActionId(id);
    try {
      await apiPost(`/doctor/appointments/${id}/end`);
      toast.success("Appointment ended.");
      fetchAppointments();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to end the appointment.";
      toast.error(msg);
    } finally {
      setActionId(null);
    }
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return {
      dateStr: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
      timeStr: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const StatusBadge = ({ status }: { status: AppointmentStatus }) => {
    switch (status) {
      case "BOOKED":
        return <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">Upcoming</span>;
      case "COMPLETED":
        return <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">Completed</span>;
      case "CANCELLED":
        return <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 ring-1 ring-inset ring-neutral-500/10">Cancelled</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 relative">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <button
            onClick={() => router.push("/doctor")}
            className="font-mono text-xs uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
          >
            &larr; Back to Dashboard
          </button>
          <h1 className="font-display text-4xl font-normal text-text-primary" style={{ letterSpacing: "-0.02em" }}>
            Appointments
          </h1>
          <p className="max-w-[60ch] text-sm text-text-muted">
            Manage your patient bookings. Mark past visits as completed or cancel upcoming ones.
          </p>
        </div>
      </header>

      <div className="rounded-lg border border-border bg-surface-raised shadow-xs">
        {/* Navigation Tabs */}
        <div className="border-b border-border px-6 pt-4">
          <div className="flex gap-6">
            {(["upcoming", "completed", "cancelled"] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setPage(1); }}
                className={`border-b-2 pb-3 text-sm font-medium capitalize transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 rounded-sm ${
                  activeTab === tab
                    ? "border-primary-600 text-primary-700"
                    : "border-transparent text-text-muted hover:border-neutral-300 hover:text-text-primary"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="space-y-4" aria-busy="true" aria-label="Loading appointments">
              {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : error ? (
            <div role="alert" className="rounded-md border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg flex items-center justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={fetchAppointments}>Retry</Button>
            </div>
          ) : !appointments || appointments.items.length === 0 ? (
            <EmptyState
              icon={
                <svg className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
              heading={`No ${activeTab} appointments`}
              body={`You don't have any ${activeTab} patient appointments to display right now.`}
            />
          ) : (
            <div className="space-y-4">
              {appointments.items.map((apt) => {
                const { dateStr, timeStr } = formatDateTime(apt.timeSlot.startTime);
                const inSession = !!apt.startedAt && !apt.endedAt;
                const slotStart = new Date(apt.timeSlot.startTime);
                const today = new Date();
                const isToday =
                  slotStart.getFullYear() === today.getFullYear() &&
                  slotStart.getMonth() === today.getMonth() &&
                  slotStart.getDate() === today.getDate();

                return (
                  <div key={apt.id} className="flex flex-col sm:flex-row sm:items-start justify-between rounded-lg border border-border bg-surface-base p-5 transition-all hover:border-border-strong hover:shadow-sm">
                    <div className="flex flex-col gap-1.5 mb-4 sm:mb-0 w-full sm:w-2/3">
                      <div className="flex items-center gap-3">
                        <h4 className="font-display text-lg font-medium text-text-primary">{apt.patient.name}</h4>
                        <StatusBadge status={apt.status} />
                        {inSession && (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-700/10">
                            In session
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-sm font-medium text-text-primary bg-neutral-50 px-3 py-1.5 rounded-md w-fit border border-border">
                        <svg className="h-4 w-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {dateStr} &middot; {timeStr}
                      </div>

                      {apt.notes && (
                        <div className="mt-3 rounded-md bg-surface-raised p-3 border border-border text-sm text-text-body italic">
                          "{apt.notes}"
                        </div>
                      )}

                      <DoctorNoteEditor
                        appointmentId={apt.id}
                        initialNote={apt.doctorNote}
                        endTime={apt.timeSlot.endTime}
                        startedAt={apt.startedAt}
                        endedAt={apt.endedAt}
                        status={apt.status}
                        onSaved={fetchAppointments}
                      />
                    </div>

                    {/* Status Actions */}
                    {apt.status === "BOOKED" && activeTab === "upcoming" && (
                      <div className="flex flex-col shrink-0 sm:ml-4 gap-2">
                        {!apt.startedAt ? (
                          isToday && (
                            <Button
                              onClick={() => handleStart(apt.id)}
                              loading={actionId === apt.id}
                              className="w-full sm:w-auto"
                            >
                              Start Appointment
                            </Button>
                          )
                        ) : (
                          <>
                            <Button
                              onClick={() => router.push(`/doctor/appointments/${apt.id}/session`)}
                              className="w-full sm:w-auto"
                            >
                              Open Session
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleEnd(apt.id)}
                              loading={actionId === apt.id}
                              className="w-full sm:w-auto text-danger-fg hover:bg-danger-bg hover:border-danger-border transition-colors"
                            >
                              End Session
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          onClick={() => handleCancel(apt.id)}
                          loading={actionId === apt.id}
                          className="w-full sm:w-auto text-danger-fg hover:bg-danger-bg hover:border-danger-border transition-colors"
                        >
                          Cancel Appointment
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

              {appointments.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border pt-6 mt-6">
                  <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  <span className="text-sm font-medium text-text-muted">
                    Page {appointments.page} of {appointments.totalPages}
                  </span>
                  <Button variant="outline" disabled={page === appointments.totalPages} onClick={() => setPage((p) => Math.min(appointments.totalPages, p + 1))}>
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}