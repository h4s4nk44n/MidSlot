"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useActiveDoctor } from "@/lib/active-doctor-context";
import {
  fetchDoctorSlots,
  createDoctorSlot,
  deleteDoctorSlot,
} from "@/lib/receptionist-api";
import { Button } from "@/components/ui/Button";
import type { TimeSlot } from "@/lib/types";

export default function ReceptionAvailabilityPage() {
  const router = useRouter();
  const { activeDoctor, hydrated } = useActiveDoctor();
  const params = useParams<{ doctorId: string }>();

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ date: "", startTime: "", endTime: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Guard: deep-link without picking a doctor sends back to reception home.
  useEffect(() => {
    if (!hydrated) return;
    if (!activeDoctor || activeDoctor.id !== params.doctorId) {
      router.replace("/reception");
    }
  }, [hydrated, activeDoctor, params.doctorId, router]);

  const fetchSlots = async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchDoctorSlots(params.doctorId);
      const nowMs = Date.now();
      const future = raw
        .filter((s) => new Date(s.endTime).getTime() > nowMs)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      setSlots(future);
    } catch (err: any) {
      setError(err.message || "Failed to load slots.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated || !activeDoctor) return;
    fetchSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, activeDoctor, params.doctorId]);

  const groupedSlots = useMemo(() => {
    const groups: Record<string, TimeSlot[]> = {};
    slots.forEach((slot) => {
      const d = new Date(slot.startTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(slot);
    });
    return groups;
  }, [slots]);

  const handleOpenModal = () => {
    const today = new Date().toISOString().split("T")[0];
    setFormData({ date: today, startTime: "09:00", endTime: "09:30" });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCreateSlot = async () => {
    setFormError(null);
    if (!formData.date || !formData.startTime || !formData.endTime) {
      setFormError("All fields are required.");
      return;
    }
    const start = new Date(`${formData.date}T${formData.startTime}:00`);
    const end = new Date(`${formData.date}T${formData.endTime}:00`);
    if (start < new Date()) {
      setFormError("Cannot create slots in the past.");
      return;
    }
    const mins = (end.getTime() - start.getTime()) / 60000;
    if (mins < 15) { setFormError("Slot must be at least 15 minutes."); return; }
    if (mins > 240) { setFormError("Slot cannot exceed 4 hours."); return; }

    setIsSubmitting(true);
    try {
      await createDoctorSlot(params.doctorId, {
        date: start.toISOString(),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      });
      setIsModalOpen(false);
      fetchSlots();
    } catch {
      setFormError("This time overlaps with an existing slot, or the server rejected the request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSlot = async (slot: TimeSlot) => {
    if (slot.isBooked) {
      alert("Cannot delete a booked slot. Cancel the appointment first.");
      return;
    }
    if (!window.confirm(`Remove this slot from ${activeDoctor?.user.name}'s schedule?`)) return;
    setDeletingId(slot.id);
    try {
      await deleteDoctorSlot(slot.id);
      fetchSlots();
    } catch (err: any) {
      alert(err.message || "Failed to delete slot.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDateHeader = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  if (!hydrated || !activeDoctor) return null;

  return (
    <div className="space-y-8 relative">
      {/* ── Header ── */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <button
            onClick={() => router.push("/reception")}
            className="font-mono text-xs uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
          >
            &larr; Back to doctors
          </button>

          {/* Doctor identity banner — MEDI-63: make clear which doctor is affected */}
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-100 font-mono text-sm font-medium text-sage-700"
            >
              {getInitials(activeDoctor.user.name)}
            </div>
            <div>
              <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
                Reception · Managing availability for
              </p>
              <h1
                className="font-display text-3xl font-normal text-text-primary"
                style={{ letterSpacing: "-0.02em" }}
              >
                {activeDoctor.user.name}&apos;s <em>slots</em>.
              </h1>
              {activeDoctor.specialization && (
                <p className="text-sm text-text-muted">{activeDoctor.specialization}</p>
              )}
            </div>
          </div>
        </div>

        <Button onClick={handleOpenModal}>+ Add slot</Button>
      </header>

      {/* ── Slots card ── */}
      <div className="rounded-lg border border-border bg-surface-raised shadow-xs p-6">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-[1.5px] border-text-muted border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-danger-border bg-danger-bg px-3 py-2.5 text-sm text-danger-fg">
            {error}
          </div>
        ) : slots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <svg className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3
              className="mb-2 font-display text-xl font-normal text-text-primary"
              style={{ letterSpacing: "-0.015em" }}
            >
              No upcoming slots.
            </h3>
            <p className="mb-6 max-w-[40ch] text-sm text-text-muted">
              {activeDoctor.user.name} has no open slots for future dates. Add availability below.
            </p>
            <Button onClick={handleOpenModal}>Add slot</Button>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.keys(groupedSlots).map((dateKey) => (
              <div key={dateKey} className="space-y-3">
                <h3 className="border-b border-border pb-2 font-display text-lg font-medium text-text-primary">
                  {formatDateHeader(groupedSlots[dateKey][0].startTime)}
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {groupedSlots[dateKey].map((slot) => (
                    <div
                      key={slot.id}
                      className={`flex flex-col rounded-md border p-4 transition-all ${
                        slot.isBooked
                          ? "border-primary-200 bg-primary-50"
                          : "border-border bg-surface-base hover:border-primary-300 hover:shadow-sm"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-mono text-sm font-medium text-text-primary">
                          {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                        </span>
                        {slot.isBooked ? (
                          <span className="inline-flex items-center rounded-sm bg-primary-50 px-2 py-0.5 font-mono text-2xs font-medium uppercase tracking-widest text-primary-700 border border-primary-200">
                            Booked
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-sm bg-success-bg px-2 py-0.5 font-mono text-2xs font-medium uppercase tracking-widest text-success-fg border border-success-border">
                            Open
                          </span>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={slot.isBooked}
                        loading={deletingId === slot.id}
                        onClick={() => handleDeleteSlot(slot)}
                        className={`w-full ${!slot.isBooked ? "text-danger-fg hover:bg-danger-bg hover:border-danger-border" : ""}`}
                      >
                        {slot.isBooked ? "Cannot delete" : "Delete slot"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add slot modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(20%_0.04_248/0.25)] p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface-raised p-6 shadow-overlay">
            {/* Whose slot is this — always visible in the modal header */}
            <div className="mb-4 rounded-md border border-sage-200 bg-sage-50 px-3 py-2">
              <p className="font-mono text-2xs font-medium uppercase tracking-widest text-sage-700">
                Adding slot for · {activeDoctor.user.name}
              </p>
            </div>

            <h3
              className="mb-4 font-display text-xl font-normal text-text-primary"
              style={{ letterSpacing: "-0.015em" }}
            >
              New availability slot
            </h3>

            <div className="mb-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full rounded-md border border-border p-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-primary">Start</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full rounded-md border border-border p-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-primary">End</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full rounded-md border border-border p-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                  />
                </div>
              </div>
              <p className="text-xs text-text-muted">Duration must be 15 min – 4 hours.</p>
            </div>

            {formError && (
              <div className="mb-4 rounded-md border border-danger-border bg-danger-bg px-3 py-2.5">
                <p className="text-sm text-danger-fg">{formError}</p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleCreateSlot} loading={isSubmitting}>
                Save slot
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => p !== "Dr." && p !== "Dr");
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + (parts.length > 1 ? last : "")).toUpperCase();
}
