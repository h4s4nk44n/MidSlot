"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchDoctorSlots } from "@/lib/receptionist-api";
import type { TimeSlot } from "@/lib/types";
import type { DoctorMinimal } from "@/lib/types";

interface SlotPickerProps {
  doctor: DoctorMinimal;
  selected: TimeSlot | null;
  onChange: (slot: TimeSlot) => void;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatDateHeader(iso: string, key: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();

  const label = d.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  if (isToday) return `Today · ${label}`;
  if (isTomorrow) return `Tomorrow · ${label}`;
  return label;
}

export function SlotPicker({ doctor, selected, onChange }: SlotPickerProps) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSlots = () => {
    setLoading(true);
    setError(null);
    fetchDoctorSlots(doctor.id)
      .then((raw) => {
        const nowMs = Date.now();
        const future = raw
          .filter((s) => new Date(s.endTime).getTime() > nowMs)
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        setSlots(future);
      })
      .catch((err: any) => setError(err.message || "Failed to load slots."))
      .finally(() => setLoading(false));
  };

  // Re-fetch when doctor changes; also clear selected via parent (caller responsibility)
  useEffect(() => {
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctor.id]);

  const grouped = useMemo(() => {
    const g: Record<string, TimeSlot[]> = {};
    slots.forEach((s) => {
      const d = new Date(s.startTime);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!g[k]) g[k] = [];
      g[k].push(s);
    });
    return g;
  }, [slots]);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-text-muted border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-danger-border bg-danger-bg px-3 py-2.5 text-sm text-danger-fg">
        {error}
        <button
          onClick={loadSlots}
          className="ml-3 font-medium underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised px-6 py-10 text-center">
        <p className="font-mono text-2xs uppercase tracking-widest text-text-subtle">No slots</p>
        <p className="mt-2 font-display text-lg font-normal text-text-primary">
          No open slots.
        </p>
        <p className="mt-1 text-sm text-text-muted">
          {doctor.user.name} has no available slots. Add them from the availability page.
        </p>
        <button
          onClick={loadSlots}
          className="mt-4 font-mono text-xs font-medium uppercase tracking-widest text-primary-700 hover:underline"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
          {doctor.user.name} · {slots.length} open slot{slots.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={loadSlots}
          className="font-mono text-2xs font-medium uppercase tracking-widest text-primary-700 hover:underline"
        >
          Refresh
        </button>
      </div>

      {Object.keys(grouped).map((dateKey) => (
        <div key={dateKey} className="space-y-2">
          <h4 className="border-b border-border pb-1.5 font-display text-sm font-medium text-text-primary">
            {formatDateHeader(grouped[dateKey][0].startTime, dateKey)}
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {grouped[dateKey].map((slot) => {
              const isSelected = selected?.id === slot.id;
              const isBooked = slot.isBooked;
              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={isBooked}
                  onClick={() => onChange(slot)}
                  title={isBooked ? "This slot is already booked" : undefined}
                  className={[
                    "flex flex-col items-center justify-center rounded-md border px-2 py-3 text-center transition-all",
                    isBooked
                      ? "cursor-not-allowed border-neutral-200 bg-neutral-100 text-text-muted opacity-60"
                      : isSelected
                      ? "border-primary-500 bg-primary-50 shadow-focus ring-1 ring-primary-500"
                      : "border-border bg-surface-base hover:border-primary-300 hover:shadow-sm",
                  ].join(" ")}
                >
                  <span
                    className={`font-mono text-sm font-medium ${
                      isSelected ? "text-primary-700" : isBooked ? "text-text-muted" : "text-text-primary"
                    }`}
                  >
                    {formatTime(slot.startTime)}
                  </span>
                  <span
                    className={`mt-0.5 font-mono text-2xs ${
                      isSelected ? "text-primary-500" : "text-text-muted"
                    }`}
                  >
                    {formatTime(slot.endTime)}
                  </span>
                  {isBooked && (
                    <span className="mt-1 rounded-sm bg-neutral-200 px-1.5 py-0.5 font-mono text-2xs uppercase tracking-widest text-text-muted">
                      Taken
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
