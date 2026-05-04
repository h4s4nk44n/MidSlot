"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/Button";

interface DashboardStats {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  availableSlots: number;
}

interface Appointment {
  id: string;
  status: "BOOKED" | "CANCELLED" | "COMPLETED";
  notes: string | null;
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

interface DashboardData {
  stats: DashboardStats;
  todaySchedule: Appointment[];
  upcomingAppointments: Appointment[];
}

export default function DoctorDashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await apiGet<DashboardData>("/doctors/dashboard");
        setDashboardData(res);
      } catch (err: any) {
        setError(err.message || "Failed to load doctor dashboard.");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[2px] border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center text-red-600">
        <p className="font-medium">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const stats = dashboardData?.stats || {
    totalAppointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    availableSlots: 0,
  };

  const todaySchedule = dashboardData?.todaySchedule || [];
  const upcomingAppointments = dashboardData?.upcomingAppointments || [];

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
            Doctor &middot; Dashboard
          </p>
          <h1 className="font-display text-4xl font-normal text-text-primary" style={{ letterSpacing: "-0.02em" }}>
            Overview
          </h1>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.location.assign("/doctor/appointments")}>
            View all appointments
          </Button>
          <Button onClick={() => window.location.assign("/doctor/availability")}>
            Add availability
          </Button>
        </div>
      </header>

      {/* --- Stat Cards --- */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total Appointments", value: stats.totalAppointments },
          { label: "Completed", value: stats.completedAppointments },
          { label: "Cancelled", value: stats.cancelledAppointments },
          { label: "Available Slots", value: stats.availableSlots },
        ].map((stat, idx) => (
          <div key={idx} className="flex flex-col justify-center rounded-lg border border-border bg-surface-raised p-6 shadow-xs transition-shadow hover:shadow-sm">
            <span className="mb-2 font-mono text-xs uppercase tracking-wider text-text-muted">{stat.label}</span>
            <span className="font-display text-3xl font-medium text-text-primary">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* --- Today's Schedule Panel --- */}
        <section className="flex flex-col rounded-lg border border-border bg-surface-raised shadow-xs">
          <div className="border-b border-border p-6">
            <h2 className="font-display text-lg font-medium text-text-primary">Today's Schedule</h2>
          </div>
          <div className="flex-1 p-6">
            {todaySchedule.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-text-muted">
                <p>No appointments scheduled for today.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {todaySchedule.map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between rounded-md border border-border bg-surface-base p-4">
                    <div>
                      <p className="font-medium text-text-primary">{apt.patient.name}</p>
                      <p className="text-sm text-text-muted">{formatTime(apt.timeSlot.startTime)} - {formatTime(apt.timeSlot.endTime)}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      {apt.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* --- Upcoming Appointments List --- */}
        <section className="flex flex-col rounded-lg border border-border bg-surface-raised shadow-xs">
          <div className="border-b border-border p-6">
            <h2 className="font-display text-lg font-medium text-text-primary">Upcoming Appointments</h2>
          </div>
          <div className="flex-1 p-6">
            {upcomingAppointments.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-text-muted">
                <p>No upcoming appointments found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingAppointments.map((apt) => (
                  <div key={apt.id} className="flex flex-col rounded-md border border-border bg-surface-base p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-text-primary">{apt.patient.name}</p>
                      <p className="text-sm text-text-muted font-medium">
                        {formatDate(apt.timeSlot.startTime)} &middot; {formatTime(apt.timeSlot.startTime)}
                      </p>
                    </div>
                    {apt.notes && (
                      <p className="text-sm text-text-muted italic border-l-2 border-border pl-2 mt-1">
                        "{apt.notes}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}