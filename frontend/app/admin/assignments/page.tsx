"use client";

/**
 * /admin/assignments — manage which doctors each receptionist can act for.
 *
 * Two-column layout:
 *  - Left:  receptionist roster, click to select.
 *  - Right: assigned doctors for the selected receptionist (× to remove)
 *           plus an "Assign doctor" picker that searches the doctor roster.
 *
 * Backend endpoints (already wired in E3):
 *  - GET    /admin/users?role=RECEPTIONIST     (receptionists)
 *  - GET    /admin/assignments                 (all current pairings)
 *  - GET    /doctors?q=…                       (doctor search)
 *  - POST   /admin/assignments {receptionistId, doctorId}
 *  - DELETE /admin/assignments/:id
 *
 * Audit entries (ASSIGNMENT_ADD / ASSIGNMENT_REMOVE) are emitted server-side.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  apiDelete,
  apiGet,
  apiPost,
  ApiError,
} from "@/lib/api";
import type { AdminUser, Doctor, Paginated } from "@/lib/types";
import { doctorDisplayName, doctorInitials } from "@/lib/doctor-name";

interface Assignment {
  id: string;
  receptionistId: string;
  doctorId: string;
  assignedAt: string;
  receptionist: { id: string; name: string; email: string };
  doctor: {
    id: string;
    title?: string | null;
    specialization: string;
    user: { id: string; name: string; email: string };
  };
}

function initials(name: string): string {
  return doctorInitials(name);
}

export default function AdminAssignmentsPage() {
  const [receptionists, setReceptionists] = useState<AdminUser[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [receptionistSearch, setReceptionistSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, assignmentsRes] = await Promise.all([
        apiGet<Paginated<AdminUser>>(
          "/admin/users?role=RECEPTIONIST&active=true&pageSize=100",
        ),
        apiGet<Assignment[]>("/admin/assignments"),
      ]);
      setReceptionists(usersRes.items);
      setAssignments(assignmentsRes);
      setSelectedId((prev) =>
        prev && usersRes.items.some((u) => u.id === prev)
          ? prev
          : (usersRes.items[0]?.id ?? null),
      );
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load assignments.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // -------------------------------------------------------------------
  //  Derived
  // -------------------------------------------------------------------

  const filteredReceptionists = useMemo(() => {
    const q = receptionistSearch.trim().toLowerCase();
    if (!q) return receptionists;
    return receptionists.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q),
    );
  }, [receptionists, receptionistSearch]);

  const countsByReceptionist = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assignments) {
      map.set(a.receptionistId, (map.get(a.receptionistId) ?? 0) + 1);
    }
    return map;
  }, [assignments]);

  const selected = useMemo(
    () => receptionists.find((r) => r.id === selectedId) ?? null,
    [receptionists, selectedId],
  );

  const selectedAssignments = useMemo(
    () =>
      selectedId
        ? assignments.filter((a) => a.receptionistId === selectedId)
        : [],
    [assignments, selectedId],
  );

  const assignedDoctorIds = useMemo(
    () => new Set(selectedAssignments.map((a) => a.doctorId)),
    [selectedAssignments],
  );

  // -------------------------------------------------------------------
  //  Mutations
  // -------------------------------------------------------------------

  const handleAssign = async (doctor: Doctor) => {
    if (!selected) return;
    // Optimistic insert keeps the picker responsive; rollback on failure.
    const tempId = `tmp-${doctor.id}`;
    const optimistic: Assignment = {
      id: tempId,
      receptionistId: selected.id,
      doctorId: doctor.id,
      assignedAt: new Date().toISOString(),
      receptionist: {
        id: selected.id,
        name: selected.name,
        email: selected.email,
      },
      doctor: {
        id: doctor.id,
        title: doctor.title ?? null,
        specialization: doctor.specialization,
        user: doctor.user,
      },
    };
    setAssignments((prev) => [optimistic, ...prev]);
    try {
      const created = await apiPost<{
        id: string;
        receptionistId: string;
        doctorId: string;
        assignedAt: string;
      }>("/admin/assignments", {
        receptionistId: selected.id,
        doctorId: doctor.id,
      });
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === tempId
            ? { ...optimistic, id: created.id, assignedAt: created.assignedAt }
            : a,
        ),
      );
      toast.success(
        `Assigned ${doctorDisplayName(doctor.user.name, doctor.title)} to ${selected.name}.`,
      );
    } catch (err) {
      setAssignments((prev) => prev.filter((a) => a.id !== tempId));
      const msg =
        err instanceof ApiError ? err.message : "Failed to assign doctor.";
      toast.error(msg);
    }
  };

  const handleRemove = async (assignment: Assignment) => {
    const snapshot = assignments;
    setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
    try {
      await apiDelete(`/admin/assignments/${assignment.id}`);
      toast.success(
        `Removed ${doctorDisplayName(assignment.doctor.user.name, assignment.doctor.title)} from ${assignment.receptionist.name}.`,
      );
    } catch (err) {
      setAssignments(snapshot);
      const msg =
        err instanceof ApiError ? err.message : "Failed to remove assignment.";
      toast.error(msg);
    }
  };

  // -------------------------------------------------------------------
  //  Render
  // -------------------------------------------------------------------

  const totalAssignments = assignments.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-3">
          <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
            Admin · Assignments
          </p>
          <h1
            className="page-title font-display text-3xl font-normal text-text-primary"
            style={{ letterSpacing: "-0.015em" }}
          >
            Receptionist &amp; <em>doctor pairings</em>
          </h1>
          <p className="max-w-[60ch] text-md text-text-muted">
            {receptionists.length === 0
              ? "No active receptionists yet. Add one from the Users roster."
              : `${receptionists.length} active receptionist${receptionists.length === 1 ? "" : "s"} · ${totalAssignments} assigned doctor${totalAssignments === 1 ? "" : "s"} in total.`}
          </p>
        </div>
      </div>

      {error ? (
        <ErrorBanner message={error} onRetry={fetchAll} />
      ) : (
        <div className="grid grid-cols-12 gap-5">
          {/* Left column: receptionists */}
          <div className="col-span-12 lg:col-span-5">
            <Panel
              title="Receptionists"
              meta={
                receptionists.length > 0
                  ? `${receptionists.length} total`
                  : undefined
              }
              toolbar={
                <input
                  type="search"
                  value={receptionistSearch}
                  onChange={(e) => setReceptionistSearch(e.target.value)}
                  placeholder="Search receptionist…"
                  className="h-[30px] w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-text-body placeholder:text-text-subtle focus:border-primary-500 focus:outline-none focus-visible:shadow-focus"
                />
              }
            >
              {loading && receptionists.length === 0 ? (
                <ListSkeleton count={5} />
              ) : filteredReceptionists.length === 0 ? (
                <EmptyState
                  title={
                    receptionists.length === 0
                      ? "No active receptionists."
                      : "No matches."
                  }
                  hint={
                    receptionists.length === 0
                      ? "Create one from /admin/users."
                      : "Try a different name or email."
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {filteredReceptionists.map((r) => {
                    const count = countsByReceptionist.get(r.id) ?? 0;
                    const active = r.id === selectedId;
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(r.id)}
                          aria-current={active ? "true" : undefined}
                          className={[
                            "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus:outline-none focus-visible:shadow-focus",
                            active
                              ? "bg-primary-50"
                              : "hover:bg-neutral-50",
                          ].join(" ")}
                        >
                          <Avatar name={r.name} />
                          <div className="min-w-0 flex-1">
                            <div
                              className={[
                                "truncate text-sm font-medium",
                                active
                                  ? "text-primary-800"
                                  : "text-text-primary",
                              ].join(" ")}
                            >
                              {r.name}
                            </div>
                            <div className="truncate font-mono text-xs text-text-muted">
                              {r.email}
                            </div>
                          </div>
                          <CountPill active={active} count={count} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          {/* Right column: assigned doctors for selection */}
          <div className="col-span-12 lg:col-span-7">
            {selected ? (
              <AssignedDoctorsPanel
                receptionist={selected}
                assignments={selectedAssignments}
                assignedDoctorIds={assignedDoctorIds}
                loading={loading && assignments.length === 0}
                onRemove={handleRemove}
                onAssign={handleAssign}
              />
            ) : (
              <Panel title="Assigned doctors">
                <EmptyState
                  title="Select a receptionist."
                  hint="Choose one from the list to view and edit their assignments."
                />
              </Panel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
//  Right panel (assigned doctors + picker)
// =====================================================================

function AssignedDoctorsPanel({
  receptionist,
  assignments,
  assignedDoctorIds,
  loading,
  onRemove,
  onAssign,
}: {
  receptionist: AdminUser;
  assignments: Assignment[];
  assignedDoctorIds: Set<string>;
  loading: boolean;
  onRemove: (a: Assignment) => void;
  onAssign: (d: Doctor) => void;
}) {
  return (
    <Panel
      title="Assigned doctors"
      meta={
        assignments.length > 0
          ? `${assignments.length} assigned`
          : undefined
      }
      header={
        <div className="flex items-center gap-3">
          <Avatar name={receptionist.name} />
          <div>
            <div className="text-sm font-medium text-text-primary">
              {receptionist.name}
            </div>
            <div className="font-mono text-xs text-text-muted">
              {receptionist.email}
            </div>
          </div>
        </div>
      }
      toolbar={
        <DoctorPicker
          excludeIds={assignedDoctorIds}
          onPick={onAssign}
        />
      }
    >
      {loading ? (
        <ListSkeleton count={3} />
      ) : assignments.length === 0 ? (
        <EmptyState
          title="No doctors assigned yet."
          hint="Use the picker above to assign a doctor."
        />
      ) : (
        <ul className="divide-y divide-border">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <Avatar name={a.doctor.user.name} sage />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-text-primary">
                  {doctorDisplayName(a.doctor.user.name, a.doctor.title)}
                </div>
                <div className="truncate font-mono text-xs text-text-muted">
                  {a.doctor.specialization} · {a.doctor.user.email}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(a)}
                aria-label={`Remove ${doctorDisplayName(a.doctor.user.name, a.doctor.title)}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-danger-bg hover:text-danger-fg focus:outline-none focus-visible:shadow-focus"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// =====================================================================
//  Doctor picker (search + click to add)
// =====================================================================

function DoctorPicker({
  excludeIds,
  onPick,
}: {
  excludeIds: Set<string>;
  onPick: (doctor: Doctor) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<Doctor[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Debounce search input — typing should not blast requests.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams();
        params.set("pageSize", "10");
        if (debounced) params.set("q", debounced);
        const res = await apiGet<Paginated<Doctor>>(
          `/doctors?${params.toString()}`,
        );
        if (!cancelled) setResults(res.items);
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          if (err instanceof ApiError) {
            toast.error(err.message);
          }
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    };
    if (open) run();
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const visible = results.filter((d) => !excludeIds.has(d.id));

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Assign doctor — search by name…"
        className="h-[30px] w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-text-body placeholder:text-text-subtle focus:border-primary-500 focus:outline-none focus-visible:shadow-focus"
      />
      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-72 overflow-y-auto rounded-md border border-border bg-surface-overlay shadow-overlay"
        >
          {searching ? (
            <div className="px-3 py-3 font-mono text-xs uppercase tracking-widest text-text-subtle">
              Searching…
            </div>
          ) : visible.length === 0 ? (
            <div className="px-3 py-3 text-sm text-text-muted">
              {results.length === 0
                ? "No doctors match."
                : "All matching doctors are already assigned."}
            </div>
          ) : (
            <ul>
              {visible.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    onClick={() => {
                      onPick(d);
                      setQuery("");
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none"
                  >
                    <Avatar name={d.user.name} sage />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-text-primary">
                        {doctorDisplayName(d.user.name, d.title)}
                      </div>
                      <div className="truncate font-mono text-xs text-text-muted">
                        {d.specialization} · {d.user.email}
                      </div>
                    </div>
                    <span className="font-mono text-2xs uppercase tracking-widest text-text-subtle">
                      add
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================================
//  Shared sub-components
// =====================================================================

function Panel({
  title,
  meta,
  header,
  toolbar,
  children,
}: {
  title: string;
  meta?: string;
  header?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-raised">
      <div className="flex items-center justify-between gap-3 rounded-t-md border-b border-border bg-surface-sunken px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          {meta && (
            <span className="font-mono text-2xs uppercase tracking-widest text-text-subtle">
              {meta}
            </span>
          )}
        </div>
      </div>
      {(header || toolbar) && (
        <div className="space-y-3 border-b border-border bg-neutral-50 px-4 py-3">
          {header}
          {toolbar}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}

function CountPill({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={[
        "inline-flex min-w-[1.5rem] items-center justify-center rounded-sm border px-1.5 py-0.5 font-mono text-2xs font-medium uppercase tracking-widest",
        active
          ? "border-primary-200 bg-primary-100 text-primary-800"
          : "border-border bg-neutral-100 text-text-body",
      ].join(" ")}
    >
      {count}
    </span>
  );
}

function Avatar({ name, sage }: { name: string; sage?: boolean }) {
  const cls = sage
    ? "bg-sage-100 text-sage-800 border-sage-200"
    : "bg-neutral-100 text-text-body border-border";
  return (
    <div
      className={[
        "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full border font-mono text-xs font-medium uppercase",
        cls,
      ].join(" ")}
    >
      {initials(name)}
    </div>
  );
}

function ListSkeleton({ count }: { count: number }) {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-100" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-40 animate-pulse rounded bg-neutral-100" />
            <div className="h-2.5 w-56 animate-pulse rounded bg-neutral-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p
        className="font-display text-lg font-normal text-text-primary"
        style={{ letterSpacing: "-0.01em" }}
      >
        {title}
      </p>
      {hint && <p className="mt-1 text-sm text-text-muted">{hint}</p>}
    </div>
  );
}

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-4 rounded-md border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="font-medium text-danger-fg underline-offset-2 hover:underline"
      >
        Retry
      </button>
    </div>
  );
}
