"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/types";

interface RouteGuardProps {
  /** Roles allowed to view this subtree. */
  roles: Role[];
  children: ReactNode;
}

/**
 * Layout-level guard. Use inside a `(role)/layout.tsx` to protect everything
 * under it. Behaves as follows:
 *
 *   - status="loading"   → render a quiet skeleton; no redirect yet.
 *   - unauthenticated    → push to /login (?from=...).
 *   - role mismatch      → render a 403 panel (no redirect, browser back works).
 *   - role match         → render children.
 */
export function RouteGuard({ roles, children }: RouteGuardProps) {
  const { user, status } = useAuth();
  const router = useRouter();

   // console.log("[RouteGuard] status:", status, "user role:", user?.role, "needs:", roles); debugging


  if (status === "loading") return <RouteGuardLoading />;
  if (status === "unauthenticated") return <RouteGuardLoading />; // brief flash before redirect
  if (!user || !roles.includes(user.role)) return <ForbiddenPanel />;

  return <>{children}</>;
}

function RouteGuardLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] items-center justify-center"
    >
      <div className="flex flex-col items-center gap-3">
        <div
          aria-hidden
          className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-text-muted border-t-transparent"
        />
        <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          Verifying session
        </p>
      </div>
    </div>
  );
}

/**
 * Inline 403. DESIGN.md §4 empty-state:
 *   centered, 1 line of serif display copy + 1 line of body muted + 1 button.
 */
function ForbiddenPanel() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-lg border border-border bg-surface-raised px-8 py-10 text-center shadow-xs">
        <p className="font-mono text-2xs uppercase tracking-widest text-text-subtle">
          Error · 403
        </p>
        <h2
          className="mt-3 font-display text-2xl font-normal text-text-primary"
          style={{ letterSpacing: "-0.015em" }}
        >
          You don&apos;t have access to this <em className="italic text-primary-700">section</em>.
        </h2>
        <p className="mt-3 text-sm text-text-muted">
          This area is reserved for a different role. If you think this is a
          mistake, contact your administrator.
        </p>
        <div className="mt-6 flex justify-center">
          <a
            href="/"
            className="inline-flex h-[34px] items-center justify-center rounded-md bg-primary-700 px-3.5 text-sm font-medium text-white no-underline transition-colors hover:bg-primary-800"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}