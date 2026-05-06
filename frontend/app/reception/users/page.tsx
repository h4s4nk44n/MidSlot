"use client";

/**
 * /reception/users — directory of every user with a Settings drawer.
 *
 * Receptionists can open any user's profile and edit it. Saves are confirmed
 * by a 6-digit code sent to the patient's phone (mock SMS via console in this
 * demo). The list itself reuses the admin /users response shape.
 */

import { useCallback, useEffect, useState } from "react";
import { apiGet, ApiError } from "@/lib/api";
import type { AdminUser, Paginated, Role } from "@/lib/types";
import { doctorDisplayName, doctorInitials } from "@/lib/doctor-name";
import { UserProfileDrawer } from "@/components/profile/UserProfileDrawer";

const ROLES: Role[] = ["ADMIN", "DOCTOR", "RECEPTIONIST", "PATIENT"];
const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  DOCTOR: "Doctor",
  RECEPTIONIST: "Receptionist",
  PATIENT: "Patient",
};

type RoleFilter = "ALL" | Role;
const PAGE_SIZE = 10;

export default function ReceptionUsersPage() {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("PATIENT");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Paginated<AdminUser> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (roleFilter !== "ALL") params.set("role", roleFilter);
      if (search) params.set("q", search);

      const res = await apiGet<Paginated<AdminUser>>(
        `/receptionist/users?${params.toString()}`,
      );
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const items = data?.items ?? [];

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
          Reception · Users
        </p>
        <h1
          className="page-title font-display text-3xl font-normal text-text-primary"
          style={{ letterSpacing: "-0.015em" }}
        >
          Directory &amp; <em>profiles</em>
        </h1>
        <p className="max-w-[60ch] text-md text-text-muted">
          Look up any user&apos;s contact info. Edits to a patient&apos;s profile are
          confirmed by a 6-digit code sent to their phone.
        </p>
      </div>

      <div
        className="flex items-center justify-between gap-4 rounded-t-md border border-border bg-neutral-50 px-3.5 py-2.5"
        style={{ borderBottom: "none" }}
      >
        <div className="flex items-center gap-2.5">
          <RoleTabs value={roleFilter} onChange={(v) => { setRoleFilter(v); setPage(1); }} />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email…"
            className="h-[30px] w-72 rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-text-body placeholder:text-text-subtle focus:border-primary-500 focus:outline-none focus-visible:shadow-focus"
          />
        </div>
      </div>

      <div
        className="rounded-b-md border border-border bg-surface-raised"
        style={{ borderTop: "none", marginTop: 0 }}
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-sunken">
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th align="right">{" "}</Th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : error ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-danger-fg">
                  {error}{" "}
                  <button
                    onClick={fetchUsers}
                    className="ml-2 text-text-link underline-offset-2 hover:underline"
                  >
                    Retry
                  </button>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-sm text-text-muted">
                  No users match these filters.
                </td>
              </tr>
            ) : (
              items.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  onOpenSettings={() => setDrawerUserId(u.id)}
                />
              ))
            )}
          </tbody>
        </table>

        {data && data.total > 0 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 font-mono text-xs text-text-muted">
            <div>
              Showing{" "}
              <strong className="text-text-primary">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
              </strong>{" "}
              of {total}
            </div>
            <div className="flex gap-1">
              <PageButton onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                ←
              </PageButton>
              <span className="px-2 text-text-muted">
                {page} / {totalPages}
              </span>
              <PageButton
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                →
              </PageButton>
            </div>
          </div>
        )}
      </div>

      {drawerUserId && (
        <UserProfileDrawer
          userId={drawerUserId}
          actor="receptionist"
          onClose={() => setDrawerUserId(null)}
        />
      )}
    </div>
  );
}

// =====================================================================

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className="border-b border-border px-5 py-2.5 font-mono text-2xs font-medium uppercase tracking-wide text-text-muted"
      style={{ textAlign: align }}
    >
      {children}
    </th>
  );
}

function RoleTabs({
  value,
  onChange,
}: {
  value: RoleFilter;
  onChange: (next: RoleFilter) => void;
}) {
  const tabs: { id: RoleFilter; label: string }[] = [
    { id: "PATIENT", label: "Patients" },
    { id: "DOCTOR", label: "Doctors" },
    { id: "RECEPTIONIST", label: "Receptionists" },
    { id: "ALL", label: "All" },
  ];
  return (
    <div className="flex overflow-hidden rounded-md border border-border bg-surface-raised">
      {tabs.map((t, idx) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={[
              "px-3 py-1.5 font-mono text-2xs uppercase tracking-widest transition-colors",
              idx > 0 ? "border-l border-border" : "",
              active
                ? "bg-primary-50 text-primary-800"
                : "bg-transparent text-text-muted hover:bg-neutral-50",
            ].join(" ")}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 animate-pulse rounded-full bg-neutral-100" />
          <div className="space-y-1.5">
            <div className="h-3 w-32 animate-pulse rounded bg-neutral-100" />
            <div className="h-2.5 w-44 animate-pulse rounded bg-neutral-100" />
          </div>
        </div>
      </td>
      <td className="px-5 py-3">
        <div className="h-5 w-20 animate-pulse rounded bg-neutral-100" />
      </td>
      <td className="px-5 py-3">
        <div className="h-5 w-16 animate-pulse rounded bg-neutral-100" />
      </td>
      <td className="px-5 py-3" />
    </tr>
  );
}

function UserRow({ user, onOpenSettings }: { user: AdminUser; onOpenSettings: () => void }) {
  const dimmed = !user.isActive;
  const display =
    user.role === "DOCTOR" ? doctorDisplayName(user.name, user.doctor?.title) : user.name;
  return (
    <tr
      className={[
        "border-b border-border last:border-b-0 transition-colors",
        dimmed ? "opacity-50" : "hover:bg-neutral-50",
      ].join(" ")}
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div
            className={[
              "flex h-7 w-7 select-none items-center justify-center rounded-full border font-mono text-xs font-medium uppercase",
              user.role === "DOCTOR"
                ? "bg-sage-100 text-sage-800 border-sage-200"
                : "bg-neutral-100 text-text-body border-border",
            ].join(" ")}
          >
            {doctorInitials(user.name)}
          </div>
          <div>
            <div className="font-medium text-text-primary">{display}</div>
            <div className="font-mono text-xs text-text-muted">{user.email}</div>
          </div>
        </div>
      </td>
      <td className="px-5 py-3">
        <span className="inline-flex items-center rounded-sm border border-border bg-neutral-100 px-1.5 py-0.5 font-mono text-2xs font-medium uppercase tracking-widest text-text-body">
          {ROLE_LABEL[user.role]}
        </span>
      </td>
      <td className="px-5 py-3">
        {user.isActive ? (
          <span className="inline-flex items-center rounded-sm border border-success-border bg-success-bg px-1.5 py-0.5 font-mono text-2xs font-medium uppercase tracking-widest text-success-fg">
            Active
          </span>
        ) : (
          <span className="inline-flex items-center rounded-sm border border-danger-border bg-danger-bg px-1.5 py-0.5 font-mono text-2xs font-medium uppercase tracking-widest text-danger-fg">
            Deactivated
          </span>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex h-7 items-center justify-center rounded-md border border-border-strong bg-surface-raised px-3 font-mono text-2xs uppercase tracking-widest text-text-body hover:bg-neutral-50"
        >
          Settings
        </button>
      </td>
    </tr>
  );
}

function PageButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  // ROLES is referenced for type completeness in some imports above; suppress unused var warning.
  void ROLES;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-sm border border-border bg-surface-raised px-2.5 py-1 font-mono text-xs text-text-body transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-text-subtle"
    >
      {children}
    </button>
  );
}
