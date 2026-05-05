"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Paginated } from "@/lib/types";
import { doctorDisplayName } from "@/lib/doctor-name";

type AppointmentStatus = "BOOKED" | "CANCELLED" | "COMPLETED";
type TabType = "upcoming" | "past" | "cancelled";

interface Appointment {
  id: string;
  status: AppointmentStatus;
  notes: string | null;
  doctorNote: string | null;
  doctor: {
    title?: string | null;
    specialization: string;
    user: {
      name: string;
    };
  };
  timeSlot: {
    date: string;
    startTime: string;
    endTime: string;
  };
}

export default function PatientAppointmentsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("upcoming");
  const [appointments, setAppointments] = useState<Paginated<Appointment> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  // Per-card disclosure state for the patient's own note + the doctor's note.
  const [openNotes, setOpenNotes] = useState<Record<string, "patient" | "doctor" | null>>({});

  const togglePanel = (id: string, panel: "patient" | "doctor") =>
    setOpenNotes((prev) => ({ ...prev, [id]: prev[id] === panel ? null : panel }));

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Force backend to filter by status to keep the 'upcoming' tab clean
      let statusQuery = "";
      if (activeTab === "upcoming") statusQuery = "&status=BOOKED";
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

  const handleCancel = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this appointment?")) return;
    
    setCancellingId(id);
    try {
      await apiPatch(`/appointments/${id}/cancel`);
      fetchAppointments();
    } catch (err: any) {
      alert(err.message || "Failed to cancel the appointment. Please try again.");
    } finally {
      setCancellingId(null);
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
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
          Patient &middot; Appointments
        </p>
        <h1 className="font-display text-4xl font-normal text-text-primary" style={{ letterSpacing: "-0.02em" }}>
          My Appointments
        </h1>
      </header>

      <div className="rounded-lg border border-border bg-surface-raised shadow-xs">
        {/* Navigation Tabs */}
        <div className="border-b border-border px-6 pt-4">
          <div className="flex gap-6">
            {(["upcoming", "past", "cancelled"] as TabType[]).map((tab) => (
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
              body={`You don't have any ${activeTab} appointments at the moment. Need to see a doctor?`}
              action={activeTab === "upcoming" ? { label: "Browse Doctors", onClick: () => router.push("/patient/doctors") } : undefined}
            />
          ) : (
            <div className="space-y-4">
              {appointments.items.map((apt) => {
                const { dateStr, timeStr } = formatDateTime(apt.timeSlot.startTime);
                
                const openPanel = openNotes[apt.id] ?? null;
                return (
                  <div key={apt.id} className="rounded-lg border border-border bg-surface-base p-5 transition-all hover:border-border-strong hover:shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                      <div className="flex flex-col gap-1.5 mb-4 sm:mb-0">
                        <div className="flex items-center gap-3">
                          <h4 className="font-display text-lg font-medium text-text-primary">{doctorDisplayName(apt.doctor.user.name, apt.doctor.title)}</h4>
                          <StatusBadge status={apt.status} />
                        </div>
                        <p className="text-sm text-text-muted">{apt.doctor.specialization}</p>

                        <div className="mt-2 flex items-center gap-2 text-sm font-medium text-text-primary bg-neutral-50 px-3 py-1.5 rounded-md w-fit border border-border">
                          <svg className="h-4 w-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {dateStr} &middot; {timeStr}
                        </div>
                      </div>

                      {apt.status === "BOOKED" && activeTab === "upcoming" && (
                        <div className="flex shrink-0 sm:ml-4">
                          <Button
                            variant="outline"
                            onClick={() => handleCancel(apt.id)}
                            loading={cancellingId === apt.id}
                            className="w-full sm:w-auto text-danger-fg hover:bg-danger-bg hover:border-danger-border transition-colors"
                          >
                            Cancel Appointment
                          </Button>
                        </div>
                      )}
                    </div>

                    {(apt.notes || apt.doctorNote) && (
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                        {apt.notes && (
                          <button
                            type="button"
                            onClick={() => togglePanel(apt.id, "patient")}
                            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                              openPanel === "patient"
                                ? "border-primary-300 bg-primary-50 text-primary-700"
                                : "border-border bg-surface-raised text-text-body hover:border-border-strong"
                            }`}
                            aria-expanded={openPanel === "patient"}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            {openPanel === "patient" ? "Hide my note" : "View my note"}
                          </button>
                        )}
                        {apt.doctorNote && (
                          <button
                            type="button"
                            onClick={() => togglePanel(apt.id, "doctor")}
                            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                              openPanel === "doctor"
                                ? "border-primary-300 bg-primary-50 text-primary-700"
                                : "border-border bg-surface-raised text-text-body hover:border-border-strong"
                            }`}
                            aria-expanded={openPanel === "doctor"}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                            {openPanel === "doctor" ? "Hide doctor's note" : "View doctor's note"}
                          </button>
                        )}
                      </div>
                    )}

                    {openPanel === "patient" && apt.notes && (
                      <div className="mt-3 rounded-md border border-border bg-surface-raised p-3">
                        <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                          My note to the doctor
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-text-body">{apt.notes}</p>
                      </div>
                    )}

                    {openPanel === "doctor" && apt.doctorNote && (
                      <div className="mt-3 rounded-md border border-border bg-surface-raised p-3">
                        <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                          Doctor's note
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-text-body">{apt.doctorNote}</p>
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