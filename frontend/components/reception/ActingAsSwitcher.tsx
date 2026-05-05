"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useActiveDoctor } from "@/lib/active-doctor-context";
import { fetchAssignedDoctors } from "@/lib/receptionist-api";
import type { DoctorMinimal } from "@/lib/types";
import { doctorDisplayName } from "@/lib/doctor-name";

/**
 * "Acting as Dr. X" switcher for the top nav. Renders only for RECEPTIONIST.
 *
 * Click → popover with the receptionist's assigned doctors. Picking one sets
 * the active-doctor context (persisted via sessionStorage) and stays where
 * the user is (no navigation). Picking "Clear" removes the active doctor.
 */
export function ActingAsSwitcher() {
  const { user, status } = useAuth();
  const { activeDoctor, setActiveDoctor, hydrated } = useActiveDoctor();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [doctors, setDoctors] = useState<DoctorMinimal[] | null>(null);
  const [loading, setLoading] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Lazy-load the doctor list the first time the popover opens.
  useEffect(() => {
    if (!open || doctors !== null) return;
    setLoading(true);
    fetchAssignedDoctors()
      .then((d) => setDoctors(d))
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false));
  }, [open, doctors]);

  // Don't render until we know the role + cached doctor are ready.
  if (status !== "authenticated" || user?.role !== "RECEPTIONIST" || !hydrated) {
    return null;
  }

  function handlePick(doctor: DoctorMinimal) {
    setActiveDoctor(doctor);
    setOpen(false);
  }

  function handleClear() {
    setActiveDoctor(null);
    setOpen(false);
  }

  function handleManage() {
    setOpen(false);
    router.push("/reception");
  }

  const label = activeDoctor
    ? `Acting as ${doctorDisplayName(activeDoctor.user.name, activeDoctor.title)}`
    : "Pick a doctor";

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={[
          "inline-flex h-[34px] items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
          activeDoctor
            ? "border-sage-300 bg-sage-50 text-sage-700 hover:bg-sage-100"
            : "border-border-strong bg-surface-raised text-text-primary hover:bg-neutral-50",
        ].join(" ")}
      >
        <span
          aria-hidden
          className={[
            "h-1.5 w-1.5 rounded-full",
            activeDoctor ? "bg-sage-500" : "bg-text-subtle",
          ].join(" ")}
        />
        <span className="max-w-[180px] truncate">{label}</span>
        <svg
          aria-hidden
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-[280px] rounded-lg border border-border bg-surface-raised shadow-overlay"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
              Acting on behalf of
            </p>
          </div>

          <div className="max-h-[320px] overflow-y-auto py-1.5">
            {loading && (
              <p className="px-3 py-2 text-sm text-text-muted">Loading…</p>
            )}

            {!loading && doctors && doctors.length === 0 && (
              <p className="px-3 py-3 text-sm text-text-muted">
                No doctors assigned yet.
              </p>
            )}

            {!loading && doctors && doctors.length > 0 && (
              <ul role="none">
                {doctors.map((d) => {
                  const isActive = activeDoctor?.id === d.id;
                  return (
                    <li key={d.id} role="none">
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={isActive}
                        onClick={() => handlePick(d)}
                        className={[
                          "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors",
                          isActive
                            ? "bg-primary-50 text-primary-700"
                            : "text-text-body hover:bg-neutral-50",
                        ].join(" ")}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {doctorDisplayName(d.user.name, d.title)}
                          </span>
                          {d.specialization && (
                            <span className="block truncate text-xs text-text-muted">
                              {d.specialization}
                            </span>
                          )}
                        </span>
                        {isActive && (
                          <svg
                            aria-hidden
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path
                              d="M5 12l5 5L20 6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            {activeDoctor ? (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-medium text-danger-fg hover:underline"
              >
                Clear selection
              </button>
            ) : (
              <span aria-hidden />
            )}
            <button
              type="button"
              onClick={handleManage}
              className="text-xs font-medium text-text-link hover:underline"
            >
              Manage doctors
            </button>
          </div>
        </div>
      )}
    </div>
  );
}