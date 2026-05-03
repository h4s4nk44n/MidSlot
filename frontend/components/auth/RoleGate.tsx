"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/types";

interface RoleGateProps {
  /** Allow-list of roles that may see `children`. */
  roles: Role[];
  /** What to render when the role check passes. */
  children: ReactNode;
  /** Optional fallback shown when the role check fails. Default: nothing. */
  fallback?: ReactNode;
}

/**
 * Inline role gate — render children only if the current user's role is in
 * `roles`. Useful for hiding action buttons, table columns, or sidebar items.
 *
 * NOTE: This is UX-level gating only. The backend still enforces
 * authorization on every request — never rely on RoleGate to prevent
 * privileged actions.
 */
export function RoleGate({ roles, children, fallback = null }: RoleGateProps) {
  const { user, status } = useAuth();

  if (status !== "authenticated" || !user) return <>{fallback}</>;
  if (!roles.includes(user.role)) return <>{fallback}</>;

  return <>{children}</>;
}