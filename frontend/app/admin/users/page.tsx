"use client";

/**
 * /admin/users — paginated user roster.
 *
 * Per acceptance criteria:
 *  - Filters: role, active, search by name/email
 *  - Row actions: change role (dropdown) and deactivate (toggle) with
 *    confirmation
 *  - Warning banner before role-changing yourself (self-lockout guard)
 *  - Deactivated users render grayed-out
 *
 * The design follows /frontend/design/reference/Admin Users.html and the
 * tokens defined in DESIGN.md §3 (Clinical Quiet).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AdminUser, Paginated, Role } from "@/lib/types";
import {
  DOCTOR_TITLES,
  doctorDisplayName,
  doctorInitials,
  type DoctorTitle,
} from "@/lib/doctor-name";
import { Button } from "@/components/ui/Button";
import { UserProfileDrawer } from "@/components/profile/UserProfileDrawer";

const ROLES: Role[] = ["ADMIN", "DOCTOR", "RECEPTIONIST", "PATIENT"];
// Roles offered in the row dropdown. ADMIN is intentionally absent — promotion
// to admin goes through Grant/Transfer admin (with confirmation) and demotion
// goes through Revoke admin. The dropdown is for the routine role moves.
const ASSIGNABLE_ROLES: Role[] = ["DOCTOR", "RECEPTIONIST", "PATIENT"];

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  DOCTOR: "Doctor",
  RECEPTIONIST: "Receptionist",
  PATIENT: "Patient",
};

type RoleFilter = "ALL" | Role;
type ActiveFilter = "all" | "active" | "deactivated";

const PAGE_SIZE = 10;

function initials(name: string): string {
  return doctorInitials(name);
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();

  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Paginated<AdminUser> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);

  // Debounce the search input — typing should not blast requests.
  // Resetting to page 1 is part of the same transition so we don't paginate
  // off the end of a smaller filtered result set.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const onRoleFilter = (next: RoleFilter) => {
    setRoleFilter(next);
    setPage(1);
  };
  const onActiveFilter = (next: ActiveFilter) => {
    setActiveFilter(next);
    setPage(1);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (roleFilter !== "ALL") params.set("role", roleFilter);
      if (activeFilter !== "all") {
        params.set("active", activeFilter === "active" ? "true" : "false");
      }
      if (search) params.set("q", search);

      const res = await apiGet<Paginated<AdminUser>>(`/admin/users?${params.toString()}`);
      setData(res);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to load users.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, activeFilter, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Mutations -----------------------------------------------------------

  const handleRoleChange = async (
    target: AdminUser,
    nextRole: Role,
    title?: DoctorTitle,
  ) => {
    if (target.role === nextRole && !title) return;
    try {
      const body: { role?: Role; title?: DoctorTitle } = {};
      if (target.role !== nextRole) body.role = nextRole;
      if (title) body.title = title;

      const updated = await apiPatch<AdminUser>(`/admin/users/${target.id}`, body);
      setData((prev) =>
        prev
          ? { ...prev, items: prev.items.map((u) => (u.id === updated.id ? updated : u)) }
          : prev,
      );
      toast.success(
        target.role !== nextRole
          ? `Role changed to ${ROLE_LABEL[nextRole]}.`
          : `Title set to ${title}.`,
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to update role.";
      toast.error(msg);
    }
  };

  const handleGrantAdmin = async (target: AdminUser) => {
    try {
      const updated = await apiPost<AdminUser>(`/admin/users/${target.id}/admin/grant`);
      setData((prev) =>
        prev
          ? { ...prev, items: prev.items.map((u) => (u.id === updated.id ? updated : u)) }
          : prev,
      );
      toast.success(`${target.name} is now an admin.`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to grant admin.";
      toast.error(msg);
    }
  };

  const handleRevokeAdmin = async (target: AdminUser) => {
    try {
      const updated = await apiPost<AdminUser>(`/admin/users/${target.id}/admin/revoke`);
      setData((prev) =>
        prev
          ? { ...prev, items: prev.items.map((u) => (u.id === updated.id ? updated : u)) }
          : prev,
      );
      toast.success(`${target.name} is no longer an admin.`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to revoke admin.";
      toast.error(msg);
    }
  };

  const handleTransferAdmin = async (target: AdminUser) => {
    try {
      await apiPost<AdminUser>(`/admin/users/${target.id}/admin/transfer`);
      toast.success(
        `Admin transferred to ${target.name}. You are now a regular user.`,
      );
      // Refresh the table to reflect both rows.
      fetchUsers();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to transfer admin.";
      toast.error(msg);
    }
  };

  const handleToggleActive = async (target: AdminUser) => {
    const nextActive = !target.isActive;
    try {
      const updated = await apiPatch<AdminUser>(`/admin/users/${target.id}`, {
        isActive: nextActive,
      });
      setData((prev) =>
        prev
          ? { ...prev, items: prev.items.map((u) => (u.id === updated.id ? updated : u)) }
          : prev,
      );
      toast.success(nextActive ? "User reactivated." : "User deactivated.");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to update status.";
      toast.error(msg);
    }
  };

  // ---------------------------------------------------------------------

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const items = data?.items ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-3">
          <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
            Admin · Users
          </p>
          <h1
            className="page-title font-display text-3xl font-normal text-text-primary"
            style={{ letterSpacing: "-0.015em" }}
          >
            Users &amp; <em>roster</em>
          </h1>
          <p className="max-w-[60ch] text-md text-text-muted">
            {total > 0
              ? `${total} user${total === 1 ? "" : "s"} across ${ROLES.length} roles. Change roles or deactivate access from here.`
              : "Roster is empty for the current filter."}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="flex items-center justify-between gap-4 rounded-t-md border border-border bg-neutral-50 px-3.5 py-2.5"
        style={{ borderBottom: "none" }}
      >
        <div className="flex items-center gap-2.5">
          <RoleTabs value={roleFilter} onChange={onRoleFilter} />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email…"
            className="h-[30px] w-72 rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-text-body placeholder:text-text-subtle focus:border-primary-500 focus:outline-none focus-visible:shadow-focus"
          />
        </div>
        <ActiveFilter value={activeFilter} onChange={onActiveFilter} />
      </div>

      {/* Table card */}
      <div className="rounded-b-md border border-border bg-surface-raised" style={{ borderTop: "none", marginTop: 0 }}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-sunken">
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Joined</Th>
              <Th align="right">{" "}</Th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <SkeletonRows count={6} />
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-danger-fg">
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
                <td colSpan={5} className="px-5 py-12 text-center">
                  <p
                    className="font-display text-lg font-normal text-text-primary"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    No users match these filters.
                  </p>
                  <p className="mt-1 text-sm text-text-muted">
                    Adjust the role tab, search, or status filter.
                  </p>
                </td>
              </tr>
            ) : (
              items.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isSelf={currentUser?.id === u.id}
                  onChangeRole={(role, title) => handleRoleChange(u, role, title)}
                  onToggleActive={() => handleToggleActive(u)}
                  onOpenSettings={() => setDrawerUserId(u.id)}
                  onGrantAdmin={() => handleGrantAdmin(u)}
                  onRevokeAdmin={() => handleRevokeAdmin(u)}
                  onTransferAdmin={() => handleTransferAdmin(u)}
                />
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 font-mono text-xs text-text-muted">
            <div>
              Showing{" "}
              <strong className="text-text-primary">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
              </strong>{" "}
              of {total}
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={(next) => setPage(next)}
            />
          </div>
        )}
      </div>

      {drawerUserId && (
        <UserProfileDrawer
          userId={drawerUserId}
          actor="admin"
          onClose={() => setDrawerUserId(null)}
        />
      )}
    </div>
  );
}

// =====================================================================
//  Sub-components
// =====================================================================

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
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
    { id: "ALL", label: "All" },
    { id: "ADMIN", label: "Admins" },
    { id: "DOCTOR", label: "Doctors" },
    { id: "RECEPTIONIST", label: "Receptionists" },
    { id: "PATIENT", label: "Patients" },
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

function ActiveFilter({
  value,
  onChange,
}: {
  value: ActiveFilter;
  onChange: (next: ActiveFilter) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ActiveFilter)}
      className="h-[30px] rounded-md border border-border-strong bg-surface-raised px-2.5 text-sm text-text-body focus:border-primary-500 focus:outline-none focus-visible:shadow-focus"
      aria-label="Filter by status"
    >
      <option value="all">All statuses</option>
      <option value="active">Active only</option>
      <option value="deactivated">Deactivated only</option>
    </select>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="border-b border-border last:border-b-0">
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
          <td className="px-5 py-3">
            <div className="h-3 w-20 animate-pulse rounded bg-neutral-100" />
          </td>
          <td className="px-5 py-3" />
        </tr>
      ))}
    </>
  );
}

function UserRow({
  user,
  isSelf,
  onChangeRole,
  onToggleActive,
  onOpenSettings,
  onGrantAdmin,
  onRevokeAdmin,
  onTransferAdmin,
}: {
  user: AdminUser;
  isSelf: boolean;
  onChangeRole: (role: Role, title?: DoctorTitle) => void;
  onToggleActive: () => void;
  onOpenSettings: () => void;
  onGrantAdmin: () => void;
  onRevokeAdmin: () => void;
  onTransferAdmin: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmGrant, setConfirmGrant] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  // When promoting a non-doctor → DOCTOR, ask for a title in the same step.
  const [promoteTitle, setPromoteTitle] = useState<DoctorTitle | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Admin lifecycle visibility flags. Admins are immutable when self or founder;
  // only non-admins may be granted admin or transferred-to.
  const targetIsAdmin = user.role === "ADMIN";
  const targetIsFounder = !!user.isFounder;
  const canGrant = !targetIsAdmin && user.isActive;
  const canRevoke = targetIsAdmin && !targetIsFounder && !isSelf;
  const canTransfer = !targetIsAdmin && user.isActive && !isSelf;
  // Self admin's role is locked — no role dropdown at all.
  const roleDropdownDisabled = isSelf && targetIsAdmin;

  // Close on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const dimmed = !user.isActive;

  const joined = new Date(user.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <tr
        className={[
          "border-b border-border last:border-b-0 transition-colors",
          dimmed ? "opacity-50" : "hover:bg-neutral-50",
        ].join(" ")}
      >
        <td className="px-5 py-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} sage={user.role === "DOCTOR"} />
            <div>
              <div className="font-medium text-text-primary">
                {user.role === "DOCTOR"
                  ? doctorDisplayName(user.name, user.doctor?.title)
                  : user.name}
                {isSelf && (
                  <span className="ml-2 font-mono text-2xs uppercase tracking-widest text-text-subtle">
                    you
                  </span>
                )}
              </div>
              <div className="font-mono text-xs text-text-muted">{user.email}</div>
            </div>
          </div>
        </td>
        <td className="px-5 py-3">
          <RoleBadge role={user.role} />
        </td>
        <td className="px-5 py-3">
          {user.isActive ? (
            <StatusBadge variant="completed">Active</StatusBadge>
          ) : (
            <StatusBadge variant="cancelled">Deactivated</StatusBadge>
          )}
        </td>
        <td className="px-5 py-3 font-mono text-xs text-text-muted">{joined}</td>
        <td className="relative px-5 py-3 text-right">
          <button
            type="button"
            aria-label="Row actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-neutral-100 hover:text-text-primary focus:outline-none focus-visible:shadow-focus"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="1.4" />
              <circle cx="12" cy="12" r="1.4" />
              <circle cx="19" cy="12" r="1.4" />
            </svg>
          </button>

          {menuOpen && (
            <div
              ref={menuRef}
              role="menu"
              className="absolute right-5 top-[calc(100%-6px)] z-30 w-72 rounded-md border border-border bg-surface-overlay p-3 text-left shadow-overlay"
            >
              {isSelf && targetIsAdmin && (
                <FoundersNoteBanner className="mb-2" />
              )}

              {!roleDropdownDisabled && (
                <>
                  <div className="px-1 pb-1.5 font-mono text-2xs uppercase tracking-widest text-text-subtle">
                    Change role
                  </div>
                  <div className="space-y-0.5">
                    {ASSIGNABLE_ROLES.map((r) => {
                      const active = r === user.role;
                      // Founder admins cannot be demoted.
                      const disabled = active || targetIsFounder;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            if (disabled) return;
                            setMenuOpen(false);
                            if (r === "DOCTOR" && user.role !== "DOCTOR") {
                              setPendingRole(r);
                              setPromoteTitle("Dr.");
                              return;
                            }
                            onChangeRole(r);
                          }}
                          disabled={disabled}
                          className={[
                            "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm",
                            active
                              ? "bg-primary-50 text-primary-800"
                              : "text-text-body hover:bg-neutral-100 hover:text-text-primary",
                            disabled && !active ? "opacity-50" : "",
                          ].join(" ")}
                        >
                          <span>{ROLE_LABEL[r]}</span>
                          {active && (
                            <span className="font-mono text-2xs uppercase tracking-widest text-primary-700">
                              current
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {(canGrant || canRevoke || canTransfer) && (
                <>
                  <div className="my-2 h-px bg-border" />
                  <div className="px-1 pb-1.5 font-mono text-2xs uppercase tracking-widest text-text-subtle">
                    Admin role
                  </div>
                  <div className="space-y-0.5">
                    {canGrant && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setConfirmGrant(true);
                        }}
                        className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-text-body hover:bg-neutral-100 hover:text-text-primary"
                      >
                        <span>Grant admin</span>
                      </button>
                    )}
                    {canRevoke && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setConfirmRevoke(true);
                        }}
                        className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-danger-fg hover:bg-danger-bg"
                      >
                        <span>Revoke admin</span>
                      </button>
                    )}
                    {canTransfer && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setConfirmTransfer(true);
                        }}
                        className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-text-body hover:bg-neutral-100 hover:text-text-primary"
                      >
                        <span>Transfer admin to this user</span>
                      </button>
                    )}
                  </div>
                </>
              )}

              <div className="my-2 h-px bg-border" />

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenSettings();
                }}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-text-body hover:bg-neutral-100 hover:text-text-primary"
              >
                <span>Settings &amp; profile</span>
                <span className="font-mono text-2xs uppercase tracking-widest text-text-subtle">
                  view
                </span>
              </button>

              {!isSelf && !targetIsFounder && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmDeactivate(true);
                  }}
                  className={[
                    "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm",
                    user.isActive
                      ? "text-danger-fg hover:bg-danger-bg"
                      : "text-text-body hover:bg-neutral-100 hover:text-text-primary",
                  ].join(" ")}
                >
                  <span>{user.isActive ? "Deactivate user" : "Reactivate user"}</span>
                </button>
              )}
            </div>
          )}
        </td>
      </tr>

      {/* Promote-to-doctor: pick a title first */}
      {pendingRole === "DOCTOR" && user.role !== "DOCTOR" && promoteTitle && (
        <ConfirmDialog
          title="Promote to doctor"
          tone="primary"
          banner={isSelf ? <SelfActionWarning /> : null}
          body={
            <div className="space-y-3">
              <p>
                <strong>{user.name}</strong> will gain doctor privileges. Pick a
                title — it will appear before their name across the app.
              </p>
              <div>
                <label className="mb-1 block font-mono text-2xs uppercase tracking-widest text-text-subtle">
                  Title
                </label>
                <select
                  value={promoteTitle}
                  onChange={(e) => setPromoteTitle(e.target.value as DoctorTitle)}
                  className="h-[34px] w-full rounded-md border border-border-strong bg-surface-raised px-2.5 text-sm text-text-body focus:border-primary-500 focus:outline-none focus-visible:shadow-focus"
                >
                  {DOCTOR_TITLES.map((t) => (
                    <option key={t} value={t}>
                      {t} {user.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          }
          confirmLabel="Promote"
          onConfirm={() => {
            const title = promoteTitle;
            setPendingRole(null);
            setPromoteTitle(null);
            if (title) onChangeRole("DOCTOR", title);
          }}
          onCancel={() => {
            setPendingRole(null);
            setPromoteTitle(null);
          }}
        />
      )}

      {/* Grant admin confirmation */}
      {confirmGrant && (
        <ConfirmDialog
          title="Grant admin to this user?"
          tone="primary"
          body={
            <>
              <strong>{user.name}</strong> will gain full admin privileges,
              including the ability to manage users, departments, and audit logs.
            </>
          }
          confirmLabel="Yes, grant admin"
          onConfirm={() => {
            setConfirmGrant(false);
            onGrantAdmin();
          }}
          onCancel={() => setConfirmGrant(false)}
        />
      )}

      {/* Revoke admin confirmation */}
      {confirmRevoke && (
        <ConfirmDialog
          title="Revoke admin from this user?"
          tone="danger"
          body={
            <>
              <strong>{user.name}</strong> will lose admin privileges and become
              a regular patient account. They can be promoted again later.
            </>
          }
          confirmLabel="Yes, revoke admin"
          onConfirm={() => {
            setConfirmRevoke(false);
            onRevokeAdmin();
          }}
          onCancel={() => setConfirmRevoke(false)}
        />
      )}

      {/* Transfer admin confirmation (caller becomes a regular user) */}
      {confirmTransfer && (
        <ConfirmDialog
          title="Transfer your admin role?"
          tone="danger"
          banner={<SelfActionWarning />}
          body={
            <>
              <strong>{user.name}</strong> will become an admin and{" "}
              <strong>your account will become a regular patient</strong>. You
              will lose access to admin tools immediately. This cannot be
              undone without another admin granting you back.
            </>
          }
          confirmLabel="Yes, transfer admin"
          onConfirm={() => {
            setConfirmTransfer(false);
            onTransferAdmin();
          }}
          onCancel={() => setConfirmTransfer(false)}
        />
      )}

      {/* Deactivate / reactivate confirmation */}
      {confirmDeactivate && (
        <ConfirmDialog
          title={user.isActive ? "Deactivate user?" : "Reactivate user?"}
          tone={user.isActive ? "danger" : "primary"}
          banner={isSelf && user.isActive ? <SelfActionWarning /> : null}
          body={
            user.isActive ? (
              <>
                <strong>{user.name}</strong> will lose access immediately.
                Past appointments and audit history are preserved.
              </>
            ) : (
              <>
                <strong>{user.name}</strong> will be able to sign in again.
              </>
            )
          }
          confirmLabel={user.isActive ? "Deactivate" : "Reactivate"}
          onConfirm={() => {
            setConfirmDeactivate(false);
            onToggleActive();
          }}
          onCancel={() => setConfirmDeactivate(false)}
        />
      )}
    </>
  );
}

function FoundersNoteBanner({ className }: { className?: string }) {
  return (
    <div
      className={[
        "flex items-start gap-2 rounded-md border border-border bg-neutral-50 px-3 py-2 text-xs text-text-muted",
        className ?? "",
      ].join(" ")}
    >
      <span>
        Your admin role is locked. Use{" "}
        <strong>Transfer admin to this user</strong> on someone else&apos;s row
        to step down.
      </span>
    </div>
  );
}

function SelfActionWarning({ className }: { className?: string }) {
  return (
    <div
      role="alert"
      className={[
        "flex items-start gap-2 rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning-fg",
        className ?? "",
      ].join(" ")}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
        className="mt-0.5 shrink-0"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <circle cx="12" cy="17" r="0.5" />
      </svg>
      <span>
        You&apos;re editing your own account. Demoting yourself or deactivating
        your account can lock you out of admin tools.
      </span>
    </div>
  );
}

function Avatar({ name, sage }: { name: string; sage?: boolean }) {
  const cls = sage
    ? "bg-sage-100 text-sage-800 border-sage-200"
    : "bg-neutral-100 text-text-body border-border";
  return (
    <div
      className={[
        "flex h-7 w-7 select-none items-center justify-center rounded-full border font-mono text-xs font-medium uppercase",
        cls,
      ].join(" ")}
    >
      {initials(name)}
    </div>
  );
}

function StatusBadge({
  variant,
  children,
}: {
  variant: "completed" | "cancelled" | "pending" | "neutral";
  children: React.ReactNode;
}) {
  const map: Record<string, string> = {
    completed: "bg-success-bg text-success-fg border-success-border",
    cancelled: "bg-danger-bg text-danger-fg border-danger-border",
    pending: "bg-warning-bg text-warning-fg border-warning-border",
    neutral: "bg-neutral-100 text-text-body border-border",
  };
  return (
    <span
      className={[
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-2xs font-medium uppercase tracking-widest",
        map[variant],
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return <StatusBadge variant="neutral">{ROLE_LABEL[role]}</StatusBadge>;
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (next: number) => void;
}) {
  const pages = useMemo(() => buildPageList(page, totalPages), [page, totalPages]);

  return (
    <div className="flex items-center gap-1">
      <PageButton onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous">
        ←
      </PageButton>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1.5 text-text-subtle">
            …
          </span>
        ) : (
          <PageButton key={p} active={p === page} onClick={() => onChange(p)}>
            {p}
          </PageButton>
        ),
      )}
      <PageButton
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next"
      >
        →
      </PageButton>
    </div>
  );
}

function PageButton({
  children,
  active,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={[
        "rounded-sm border px-2.5 py-1 font-mono text-xs transition-colors",
        active
          ? "border-primary-700 bg-primary-700 text-white"
          : "border-border bg-surface-raised text-text-body hover:bg-neutral-50",
        "disabled:cursor-not-allowed disabled:text-text-subtle disabled:hover:bg-surface-raised",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 1) return [1];
  const out: (number | "…")[] = [];
  const window = 1;
  for (let p = 1; p <= total; p++) {
    const inWindow = p === 1 || p === total || Math.abs(p - current) <= window;
    if (inWindow) {
      out.push(p);
    } else if (out[out.length - 1] !== "…") {
      out.push("…");
    }
  }
  return out;
}

// =====================================================================
//  Confirm dialog
// =====================================================================

function ConfirmDialog({
  title,
  body,
  banner,
  tone,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: React.ReactNode;
  banner?: React.ReactNode;
  tone: "danger" | "primary";
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: "oklch(20% 0.04 248 / 0.25)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-[480px] rounded-lg border border-border bg-surface-raised shadow-overlay">
        <div className="px-6 pt-5 pb-2">
          <h2
            id="confirm-title"
            className="font-display text-xl font-normal text-text-primary"
            style={{ letterSpacing: "-0.01em" }}
          >
            {title}
          </h2>
        </div>
        <div className="space-y-3 px-6 pb-5 text-sm text-text-body">
          {banner}
          <p>{body}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-neutral-50 px-6 py-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            className={[
              "inline-flex h-[34px] items-center justify-center rounded-md px-4 text-sm font-medium transition-colors",
              tone === "danger"
                ? "border border-danger-solid bg-danger-solid text-white hover:brightness-95"
                : "border border-primary-700 bg-primary-700 text-white hover:bg-primary-800",
            ].join(" ")}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
