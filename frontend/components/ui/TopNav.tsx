"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useActiveDoctor } from "@/lib/active-doctor-context";
import { ActingAsSwitcher } from "@/components/reception/ActingAsSwitcher";

export function TopNav() {
  const { user, logout, status } = useAuth();
  const { activeDoctor } = useActiveDoctor();

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

        {/* Right Side: User Info, Acting-as switcher, Links */}
        <div className="flex items-center gap-4">
          {/* Acting-as switcher: only renders for RECEPTIONIST (component returns null for other roles). */}
          <ActingAsSwitcher />

          {/* User Info Block */}
          {status !== "loading" && user && (
            <div className="hidden flex-col items-end border-r border-border pr-5 sm:flex">
              <span className="text-sm font-semibold text-text-primary">
                {user.role === "DOCTOR" && !user.name.startsWith("Dr.")
                  ? `Dr. ${user.name}`
                  : user.name}
              </span>
              <span className="text-xs font-medium capitalize text-text-muted">
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
                      <Link
                        href="/patient/doctors"
                        className="no-underline transition-colors hover:text-text-primary"
                      >
                        Find a doctor
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/patient/appointments"
                        className="no-underline transition-colors hover:text-text-primary"
                      >
                        My appointments
                      </Link>
                    </li>
                  </>
                )}

                {/* Doctor Links */}
                {user.role === "DOCTOR" && (
                  <>
                    <li>
                      <Link
                        href="/doctor"
                        className="no-underline transition-colors hover:text-text-primary"
                      >
                        Dashboard
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/doctor/appointments"
                        className="no-underline transition-colors hover:text-text-primary"
                      >
                        Appointments
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/doctor/availability"
                        className="no-underline transition-colors hover:text-text-primary"
                      >
                        Availability
                      </Link>
                    </li>
                  </>
                )}

                {/* Receptionist Links */}
                {user.role === "RECEPTIONIST" && (
                  <>
                    <li>
                      <Link
                        href="/reception"
                        className="no-underline transition-colors hover:text-text-primary"
                      >
                        My doctors
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/reception/appointments"
                        className="no-underline transition-colors hover:text-text-primary"
                      >
                        Appointments
                      </Link>
                    </li>
                    <li>
                      {activeDoctor ? (
                        <Link
                          href="/reception/book"
                          className="no-underline transition-colors hover:text-text-primary"
                        >
                          Book appointment
                        </Link>
                      ) : (
                        <Link
                          href="/reception"
                          title="Select a doctor first"
                          className="cursor-not-allowed text-text-muted no-underline"
                        >
                          Book appointment
                        </Link>
                      )}
                    </li>
                  </>
                )}

                {/* Admin Links */}
                {user.role === "ADMIN" && (
                  <li>
                    <Link
                      href="/admin"
                      className="no-underline transition-colors hover:text-text-primary"
                    >
                      Admin
                    </Link>
                  </li>
                )}

                {/* Universal Sign Out Button */}
                <li>
                  <button
                    onClick={logout}
                    className="font-medium text-danger-fg transition-colors hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-border rounded-sm"
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