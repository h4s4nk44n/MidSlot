"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Paginated } from "@/lib/types";

type AppointmentStatus = "BOOKED" | "CANCELLED" | "COMPLETED";
type TabType = "upcoming" | "past" | "cancelled";

interface Appointment {
  id: string;
  status: AppointmentStatus;
  notes: string | null;
  doctor: {
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
                
                return (
                  <div key={apt.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-border bg-surface-base p-5 transition-all hover:border-border-strong hover:shadow-sm">
                    <div className="flex flex-col gap-1.5 mb-4 sm:mb-0">
                      <div className="flex items-center gap-3">
                        <h4 className="font-display text-lg font-medium text-text-primary">Dr. {apt.doctor.user.name}</h4>
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