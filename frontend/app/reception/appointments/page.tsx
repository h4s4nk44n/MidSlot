"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch } from "@/lib/api";
import { fetchAssignedDoctors } from "@/lib/receptionist-api";
import { Button } from "@/components/ui/Button";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Paginated, AppointmentStatus } from "@/lib/types";
import type { DoctorMinimal } from "@/lib/types";
import { doctorDisplayName } from "@/lib/doctor-name";

interface ReceptionAppointment {
  id: string;
  status: AppointmentStatus;
  notes: string | null;
  doctorNote: string | null;
  patient: { id: string; name: string; email: string };
  doctor: { id: string; title?: string | null; user: { name: string } };
  timeSlot: { date: string; startTime: string; endTime: string };
}

const STATUS_TABS = [
  { key: "BOOKED", label: "Upcoming" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
] as const;

type TabKey = (typeof STATUS_TABS)[number]["key"];

export default function ReceptionAppointmentsPage() {
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>("BOOKED");
  const [page, setPage] = useState(1);
  const [doctorFilter, setDoctorFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const [appointments, setAppointments] = useState<Paginated<ReceptionAppointment> | null>(null);
  const [doctors, setDoctors] = useState<DoctorMinimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  // Load assigned doctors once for the filter dropdown
  useEffect(() => {
    fetchAssignedDoctors()
      .then(setDoctors)
      .catch(() => {});
  }, []);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status: tab,
        page: String(page),
        pageSize: "10",
      });
      if (doctorFilter) params.set("doctorId", doctorFilter);
      if (dateFilter) params.set("date", dateFilter);
      const res = await apiGet<Paginated<ReceptionAppointment>>(
        `/receptionist/appointments?${params.toString()}`,
      );
      setAppointments(res);
    } catch (err: any) {
      setError(err.message || "Failed to load appointments.");
    } finally {
      setLoading(false);
    }
  }, [tab, page, doctorFilter, dateFilter]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Reset page when filters change
  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(1);
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm("Cancel this appointment?")) return;
    setActionId(id);
    try {
      await apiPatch(`/receptionist/appointments/${id}/cancel`);
      fetchAppointments();
    } catch (err: any) {
      alert(err.message || "Failed to cancel.");
    } finally {
      setActionId(null);
    }
  };

  const handleComplete = async (id: string) => {
    if (!window.confirm("Mark this appointment as completed?")) return;
    setActionId(id);
    try {
      await apiPatch(`/appointments/${id}/complete`);
      fetchAppointments();
    } catch (err: any) {
      alert(err.message || "Failed to mark as completed.");
    } finally {
      setActionId(null);
    }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <button
            onClick={() => router.push("/reception")}
            className="font-mono text-xs uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
          >
            &larr; Back to doctors
          </button>
          <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
            Reception · All assigned doctors
          </p>
          <h1
            className="font-display text-4xl font-normal text-text-primary"
            style={{ letterSpacing: "-0.02em" }}
          >
            All <em>appointments</em>.
          </h1>
          <p className="max-w-[60ch] text-sm text-text-muted">
            Appointments across all doctors you manage. Filter by doctor, status, or date.
          </p>
        </div>
        <Button onClick={() => router.push("/reception/book")}>
          + Book appointment
        </Button>
      </header>

      <div className="rounded-lg border border-border bg-surface-raised shadow-xs">
        {/* ── Tabs ── */}
        <div className="border-b border-border px-6 pt-4">
          <div className="flex gap-6">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setPage(1); }}
                className={`border-b-2 pb-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 rounded-sm ${
                  tab === t.key
                    ? "border-primary-600 text-primary-700"
                    : "border-transparent text-text-muted hover:border-neutral-300 hover:text-text-primary"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-3 border-b border-border px-6 py-3">
          <label className="sr-only" htmlFor="doctor-filter">Filter by doctor</label>
          <select
            id="doctor-filter"
            value={doctorFilter}
            onChange={(e) => handleFilterChange(setDoctorFilter)(e.target.value)}
            className="h-8 rounded-md border border-border bg-surface-base px-2.5 text-sm text-text-primary focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
          >
            <option value="">All doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{doctorDisplayName(d.user.name, d.title)}</option>
            ))}
          </select>

          <label className="sr-only" htmlFor="date-filter">Filter by date</label>
          <input
            id="date-filter"
            type="date"
            value={dateFilter}
            onChange={(e) => handleFilterChange(setDateFilter)(e.target.value)}
            className="h-8 rounded-md border border-border bg-surface-base px-2.5 text-sm text-text-primary focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
          />

          {(doctorFilter || dateFilter) && (
            <button
              onClick={() => { setDoctorFilter(""); setDateFilter(""); setPage(1); }}
              aria-label="Clear all filters"
              className="font-mono text-2xs font-medium uppercase tracking-widest text-text-muted hover:text-danger-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-sm"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          {loading ? (
            <table className="w-full min-w-[720px] border-collapse text-sm" aria-busy="true" aria-label="Loading appointments">
              <thead>
                <tr className="border-b border-border bg-surface-sunken">
                  {["Patient", "Doctor", "Date & time", "Status", "Notes", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-mono text-2xs font-medium uppercase tracking-wide text-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)}
              </tbody>
            </table>
          ) : error ? (
            <div role="alert" className="m-6 rounded-md border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg flex items-center justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={fetchAppointments}>Retry</Button>
            </div>
          ) : !appointments || appointments.items.length === 0 ? (
            <EmptyState
              heading={`No ${tab.toLowerCase()} appointments`}
              body={doctorFilter || dateFilter ? "Try clearing the filters." : "Nothing to show here yet."}
              action={doctorFilter || dateFilter ? { label: "Clear filters", onClick: () => { setDoctorFilter(""); setDateFilter(""); setPage(1); } } : undefined}
            />
          ) : (
            <>
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-sunken">
                    {["Patient", "Doctor", "Date & time", "Status", "Notes", "Actions"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left font-mono text-2xs font-medium uppercase tracking-wide text-text-muted"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {appointments.items.map((apt) => {
                    const isPast = new Date(apt.timeSlot.endTime).getTime() < Date.now();
                    return (
                      <tr
                        key={apt.id}
                        className="border-b border-border transition-colors hover:bg-neutral-50"
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-text-primary">{apt.patient.name}</span>
                          <span className="block text-xs text-text-muted">{apt.patient.email}</span>
                        </td>
                        <td className="px-4 py-3 text-text-body">{doctorDisplayName(apt.doctor.user.name, apt.doctor.title)}</td>
                        <td className="px-4 py-3 font-mono text-sm text-text-primary">
                          {fmt(apt.timeSlot.startTime)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={apt.status} />
                        </td>
                        <td className="max-w-[220px] px-4 py-3 text-xs text-text-muted">
                          {apt.notes || apt.doctorNote ? (
                            <div className="space-y-1.5">
                              {apt.notes && (
                                <div title={apt.notes}>
                                  <span className="font-mono text-[10px] uppercase tracking-widest text-text-subtle">Patient</span>
                                  <p className="line-clamp-2 italic">{apt.notes}</p>
                                </div>
                              )}
                              {apt.doctorNote && (
                                <div title={apt.doctorNote}>
                                  <span className="font-mono text-[10px] uppercase tracking-widest text-text-subtle">Doctor</span>
                                  <p className="line-clamp-2">{apt.doctorNote}</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-text-subtle">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {apt.status === "BOOKED" && (
                            <div className="flex gap-2">
                              {isPast && (
                                <button
                                  onClick={() => handleComplete(apt.id)}
                                  disabled={actionId === apt.id}
                                  className="font-mono text-2xs font-medium uppercase tracking-widest text-success-fg hover:underline disabled:opacity-50"
                                >
                                  {actionId === apt.id ? "…" : "Complete"}
                                </button>
                              )}
                              <button
                                onClick={() => handleCancel(apt.id)}
                                disabled={actionId === apt.id}
                                className="font-mono text-2xs font-medium uppercase tracking-widest text-danger-fg hover:underline disabled:opacity-50"
                              >
                                {actionId === apt.id ? "…" : "Cancel"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {appointments.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-6 py-4">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <span className="font-mono text-xs text-text-muted">
                    Page {appointments.page} of {appointments.totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={page === appointments.totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const map: Record<AppointmentStatus, { bg: string; border: string; fg: string; label: string }> = {
    BOOKED: { bg: "bg-primary-50", border: "border-primary-200", fg: "text-primary-700", label: "Booked" },
    COMPLETED: { bg: "bg-success-bg", border: "border-success-border", fg: "text-success-fg", label: "Completed" },
    CANCELLED: { bg: "bg-danger-bg", border: "border-danger-border", fg: "text-danger-fg", label: "Cancelled" },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-2xs font-medium uppercase tracking-widest ${s.bg} ${s.border} ${s.fg}`}>
      {s.label}
    </span>
  );
}
