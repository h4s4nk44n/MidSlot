"use client";

/**
 * /admin/doctors — focused view for assigning titles and departments.
 *
 * Lists DOCTOR users only (re-uses GET /admin/users?role=DOCTOR) and exposes
 * two inline pickers per row: title (from DOCTOR_TITLES) and department (from
 * the curated Department dictionary). Both fields are persisted via the
 * existing PATCH /admin/users/:id endpoint, which now also accepts
 * `specialization`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiGet, apiPatch, ApiError } from "@/lib/api";
import type { AdminUser, Paginated } from "@/lib/types";
import {
  DOCTOR_TITLES,
  doctorDisplayName,
  doctorInitials,
  type DoctorTitle,
} from "@/lib/doctor-name";
import { UserProfileDrawer } from "@/components/profile/UserProfileDrawer";

interface Department {
  id: string;
  name: string;
}

const PAGE_SIZE = 20;

export default function AdminDoctorsPage() {
  const [data, setData] = useState<Paginated<AdminUser> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [departments, setDepartments] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);

  // Debounce search input.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("role", "DOCTOR");
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (search) params.set("q", search);
      const res = await apiGet<Paginated<AdminUser>>(`/admin/users?${params.toString()}`);
      setData(res);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to load doctors.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  // Load departments once for the picker.
  useEffect(() => {
    let cancelled = false;
    apiGet<Department[]>("/departments")
      .then((res) => {
        if (!cancelled) setDepartments(res.map((d) => d.name));
      })
      .catch(() => {
        // Non-critical: dropdown will simply have no options.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Optimistic field update with rollback on error.
  const patchDoctor = async (
    target: AdminUser,
    body: {
      title?: DoctorTitle;
      specialization?: string;
    },
    successLabel: string,
  ) => {
    const prev = data;
    // Optimistic local merge — only the target row.
    setData((curr) =>
      curr
        ? {
            ...curr,
            items: curr.items.map((u) =>
              u.id === target.id
                ? {
                    ...u,
                    doctor: {
                      title: body.title ?? u.doctor?.title ?? null,
                      specialization:
                        body.specialization ?? u.doctor?.specialization ?? null,
                      gender: u.doctor?.gender ?? "UNDISCLOSED",
                      dateOfBirth: u.doctor?.dateOfBirth ?? null,
                    },
                  }
                : u,
            ),
          }
        : curr,
    );
    try {
      const updated = await apiPatch<AdminUser>(`/admin/users/${target.id}`, body);
      setData((curr) =>
        curr
          ? {
              ...curr,
              items: curr.items.map((u) => (u.id === updated.id ? updated : u)),
            }
          : curr,
      );
      toast.success(successLabel);
    } catch (err) {
      setData(prev);
      const msg = err instanceof ApiError ? err.message : "Failed to update doctor.";
      toast.error(msg);
    }
  };

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const items = data?.items ?? [];

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
          Admin · Doctor profiles
        </p>
        <h1
          className="page-title font-display text-3xl font-normal text-text-primary"
          style={{ letterSpacing: "-0.015em" }}
        >
          Doctor <em>profiles</em>
        </h1>
        <p className="max-w-[60ch] text-md text-text-muted">
          {total > 0
            ? `Assign a title and department for ${total} doctor${total === 1 ? "" : "s"}. Changes save automatically.`
            : "No doctors found. Promote a user to DOCTOR from the Users page first."}
        </p>
      </div>

      {/* Toolbar + table in one merged card so there is no visual gap. */}
      <div className="overflow-hidden rounded-md border border-border bg-surface-raised">
        <div className="flex items-center justify-between border-b border-border bg-neutral-50 px-3.5 py-2.5">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email…"
            className="h-[30px] w-72 rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-text-body placeholder:text-text-subtle focus:border-primary-500 focus:outline-none focus-visible:shadow-focus"
          />
          {departments.length === 0 && (
            <span className="font-mono text-2xs uppercase tracking-widest text-warning-fg">
              No departments configured — add one in Departments
            </span>
          )}
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-sunken">
              <Th>Doctor</Th>
              <Th>Title</Th>
              <Th>Department</Th>
              <Th>{" "}</Th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <SkeletonRows count={6} />
            ) : error ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-danger-fg">
                  {error}{" "}
                  <button
                    onClick={fetchDoctors}
                    className="ml-2 text-text-link underline-offset-2 hover:underline"
                  >
                    Retry
                  </button>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center">
                  <p
                    className="font-display text-lg font-normal text-text-primary"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    No doctors match the current filters.
                  </p>
                </td>
              </tr>
            ) : (
              items.map((u) => {
                const currentTitle = (u.doctor?.title as DoctorTitle | undefined) ?? "Dr.";
                const currentDept = u.doctor?.specialization ?? "";
                return (
                  <tr
                    key={u.id}
                    className="border-b border-border last:border-b-0 transition-colors hover:bg-neutral-50"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} />
                        <div>
                          <div className="font-medium text-text-primary">
                            {doctorDisplayName(u.name, u.doctor?.title)}
                          </div>
                          <div className="font-mono text-xs text-text-muted">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={currentTitle}
                        onChange={(e) => {
                          const t = e.target.value as DoctorTitle;
                          if (t === currentTitle) return;
                          patchDoctor(u, { title: t }, `Title set to ${t}.`);
                        }}
                        className="h-[30px] w-44 rounded-md border border-border-strong bg-surface-raised px-2 text-sm text-text-body focus:border-primary-500 focus:outline-none focus-visible:shadow-focus"
                        aria-label={`Title for ${u.name}`}
                      >
                        {DOCTOR_TITLES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={departments.includes(currentDept) ? currentDept : ""}
                        onChange={(e) => {
                          const d = e.target.value;
                          if (!d || d === currentDept) return;
                          patchDoctor(u, { specialization: d }, `Department set to ${d}.`);
                        }}
                        disabled={departments.length === 0}
                        className="h-[30px] w-56 rounded-md border border-border-strong bg-surface-raised px-2 text-sm text-text-body focus:border-primary-500 focus:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:bg-neutral-50"
                        aria-label={`Department for ${u.name}`}
                      >
                        <option value="" disabled>
                          {currentDept
                            ? `${currentDept} (legacy — pick to update)`
                            : "Select a department…"}
                        </option>
                        {departments.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDrawerUserId(u.id)}
                        className="inline-flex h-7 items-center justify-center rounded-md border border-border-strong bg-surface-raised px-3 font-mono text-2xs uppercase tracking-widest text-text-body hover:bg-neutral-50"
                      >
                        Settings
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {drawerUserId && (
          <UserProfileDrawer
            userId={drawerUserId}
            actor="admin"
            onClose={() => setDrawerUserId(null)}
          />
        )}

        {data && data.total > 0 && totalPages > 1 && (
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
    </div>
  );
}

// =====================================================================
//  Sub-components
// =====================================================================

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-border px-5 py-2.5 text-left font-mono text-2xs font-medium uppercase tracking-wide text-text-muted">
      {children}
    </th>
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
            <div className="h-7 w-44 animate-pulse rounded bg-neutral-100" />
          </td>
          <td className="px-5 py-3">
            <div className="h-7 w-56 animate-pulse rounded bg-neutral-100" />
          </td>
          <td className="px-5 py-3 text-right">
            <div className="ml-auto h-7 w-20 animate-pulse rounded bg-neutral-100" />
          </td>
        </tr>
      ))}
    </>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-7 w-7 select-none items-center justify-center rounded-full border border-sage-200 bg-sage-100 font-mono text-xs font-medium uppercase text-sage-800">
      {doctorInitials(name)}
    </div>
  );
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
