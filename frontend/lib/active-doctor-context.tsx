"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DoctorMinimal } from "./types";

const STORAGE_KEY = "midslot_active_doctor";

interface ActiveDoctorContextValue {
  /** The doctor the receptionist is currently acting on behalf of. */
  activeDoctor: DoctorMinimal | null;
  /** Set or clear the active doctor. Persisted to sessionStorage. */
  setActiveDoctor: (doctor: DoctorMinimal | null) => void;
  /** True until sessionStorage has been read after mount. */
  hydrated: boolean;
}

const ActiveDoctorContext = createContext<ActiveDoctorContextValue | null>(null);

function readCached(): DoctorMinimal | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DoctorMinimal) : null;
  } catch {
    return null;
  }
}

function writeCached(doctor: DoctorMinimal | null) {
  if (typeof window === "undefined") return;
  try {
    if (doctor) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(doctor));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Holds the "Acting as Dr. X" selection across reception pages. Survives
 * navigation via sessionStorage; cleared when the tab closes or on logout.
 *
 * Rendered at the root layout so any page (top nav, schedule, booking
 * modal, etc.) can read or set it. Non-receptionist roles simply don't
 * use it, no harm done.
 */
export function ActiveDoctorProvider({ children }: { children: ReactNode }) {
  const [activeDoctor, setActiveDoctorState] = useState<DoctorMinimal | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Read sessionStorage AFTER mount to avoid SSR/CSR hydration mismatch.
  useEffect(() => {
    const cached = readCached();
    if (cached) setActiveDoctorState(cached);
    setHydrated(true);
  }, []);

  const setActiveDoctor = useCallback((doctor: DoctorMinimal | null) => {
    setActiveDoctorState(doctor);
    writeCached(doctor);
  }, []);

  const value = useMemo<ActiveDoctorContextValue>(
    () => ({ activeDoctor, setActiveDoctor, hydrated }),
    [activeDoctor, setActiveDoctor, hydrated],
  );

  return (
    <ActiveDoctorContext.Provider value={value}>
      {children}
    </ActiveDoctorContext.Provider>
  );
}

export function useActiveDoctor(): ActiveDoctorContextValue {
  const ctx = useContext(ActiveDoctorContext);
  if (!ctx) {
    throw new Error("useActiveDoctor must be used within <ActiveDoctorProvider>");
  }
  return ctx;
}