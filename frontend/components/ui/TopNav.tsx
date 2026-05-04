"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function TopNav() {
  const { user, logout, status } = useAuth();

  return (
    <header className="h-topnav sticky top-0 z-20 border-b border-border bg-surface-raised">
      <nav className="mx-auto flex h-full max-w-content items-center justify-between px-6">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 text-text-primary no-underline">
          <span
            aria-hidden
            className="relative block h-[22px] w-[22px] shrink-0 rounded-[5px] bg-primary-700"
          >
            <span className="absolute left-[6px] top-[10px] h-[2px] w-[10px] rounded-[1px] bg-white" />
            <span className="absolute left-[10px] top-[6px] h-[10px] w-[2px] rounded-[1px] bg-white" />
          </span>
          <span
            className="font-display text-md font-medium"
            style={{ letterSpacing: "-0.015em" }}
          >
            Medi<em className="font-normal italic text-primary-600">Slot</em>
          </span>
        </Link>

        {/* Right Side: User Info & Links */}
        <div className="flex items-center">
          
          {/* User Info Block */}
          {status !== "loading" && user && (
            <div className="mr-5 pr-5 border-r border-border hidden sm:flex flex-col items-end">
              <span className="text-sm font-semibold text-text-primary">
                {user.role === "DOCTOR" && !user.name.startsWith("Dr.") ? `Dr. ${user.name}` : user.name}
              </span>
              <span className="text-xs font-medium text-text-muted capitalize">
                {user.role.toLowerCase()}
              </span>
            </div>
          )}

          {/* Dynamic Navigation Links Based on User Role */}
          <ul className="flex items-center gap-5 text-sm font-medium text-text-body">
            {status === "loading" ? null : !user ? (
              <li>
                <Link
                  href="/login"
                  className="inline-flex h-[34px] items-center justify-center rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm font-medium text-text-primary no-underline transition-colors hover:bg-neutral-50"
                >
                  Sign in
                </Link>
              </li>
            ) : (
              <>
                {/* Patient Links */}
                {user.role === "PATIENT" && (
                  <>
                    <li>
                      <Link href="/patient/doctors" className="no-underline transition-colors hover:text-text-primary">
                        Find a doctor
                      </Link>
                    </li>
                    <li>
                      <Link href="/patient/appointments" className="no-underline transition-colors hover:text-text-primary">
                        My appointments
                      </Link>
                    </li>
                  </>
                )}

                {/* Doctor Links */}
                {user.role === "DOCTOR" && (
                  <>
                    <li>
                      <Link href="/doctor" className="no-underline transition-colors hover:text-text-primary">
                        Dashboard
                      </Link>
                    </li>
                    <li>
                      <Link href="/doctor/appointments" className="no-underline transition-colors hover:text-text-primary">
                        Appointments
                      </Link>
                    </li>
                    <li>
                      <Link href="/doctor/availability" className="no-underline transition-colors hover:text-text-primary">
                        Availability
                      </Link>
                    </li>
                  </>
                )}

                {/* Universal Sign Out Button */}
                <li>
                  <button
                    onClick={logout}
                    className="font-medium text-danger-fg transition-colors hover:text-red-700"
                  >
                    Sign out
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>
      </nav>
    </header>
  );
}