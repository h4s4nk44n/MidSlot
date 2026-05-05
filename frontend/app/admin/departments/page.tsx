"use client";

/**
 * /admin/departments — curated dictionary of hospital departments.
 *
 * Departments power specialization pickers and patient-facing filters. The
 * underlying Doctor.specialization remains a free string so deleting a
 * department here never orphans existing doctors — it only removes the entry
 * from future pickers.
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiGet, apiPost, apiDelete, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";

interface Department {
  id: string;
  name: string;
  createdAt: string;
}

export default function AdminDepartmentsPage() {
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Department | null>(null);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<Department[]>("/departments");
      setItems(res);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to load departments.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const created = await apiPost<Department>("/admin/departments", { name: trimmed });
      setItems((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setName("");
      toast.success(`Added ${created.name}.`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to add department.";
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (dept: Department) => {
    // Optimistic remove with rollback on error.
    const prev = items;
    setItems((curr) => curr.filter((d) => d.id !== dept.id));
    try {
      await apiDelete(`/admin/departments/${dept.id}`);
      toast.success(`Removed ${dept.name}.`);
    } catch (err) {
      setItems(prev);
      const msg = err instanceof ApiError ? err.message : "Failed to delete department.";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
          Admin · Departments
        </p>
        <h1
          className="page-title font-display text-3xl font-normal text-text-primary"
          style={{ letterSpacing: "-0.015em" }}
        >
          Departments &amp; <em>specializations</em>
        </h1>
        <p className="max-w-[60ch] text-md text-text-muted">
          {items.length > 0
            ? `${items.length} department${items.length === 1 ? "" : "s"} available for doctor profiles and patient filters.`
            : "No departments yet — add the first one below."}
        </p>
      </div>

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="flex items-end gap-3 rounded-md border border-border bg-surface-raised p-4"
      >
        <div className="flex-1 space-y-1">
          <label
            htmlFor="dept-name"
            className="block font-mono text-2xs uppercase tracking-widest text-text-subtle"
          >
            New department
          </label>
          <input
            id="dept-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Hematology"
            maxLength={80}
            className="h-[34px] w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-text-body placeholder:text-text-subtle focus:border-primary-500 focus:outline-none focus-visible:shadow-focus"
          />
        </div>
        <Button type="submit" disabled={adding || name.trim().length < 2}>
          {adding ? "Adding…" : "Add department"}
        </Button>
      </form>

      {/* Table */}
      <div className="rounded-md border border-border bg-surface-raised">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-sunken">
              <th
                className="border-b border-border px-5 py-2.5 text-left font-mono text-2xs font-medium uppercase tracking-wide text-text-muted"
              >
                Name
              </th>
              <th
                className="border-b border-border px-5 py-2.5 text-left font-mono text-2xs font-medium uppercase tracking-wide text-text-muted"
              >
                Created
              </th>
              <th className="border-b border-border px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-b-0">
                  <td className="px-5 py-3">
                    <div className="h-3 w-40 animate-pulse rounded bg-neutral-100" />
                  </td>
                  <td className="px-5 py-3">
                    <div className="h-3 w-24 animate-pulse rounded bg-neutral-100" />
                  </td>
                  <td className="px-5 py-3" />
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-sm text-danger-fg">
                  {error}{" "}
                  <button
                    onClick={fetchDepartments}
                    className="ml-2 text-text-link underline-offset-2 hover:underline"
                  >
                    Retry
                  </button>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-12 text-center">
                  <p
                    className="font-display text-lg font-normal text-text-primary"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    No departments yet.
                  </p>
                  <p className="mt-1 text-sm text-text-muted">
                    Use the form above to add one.
                  </p>
                </td>
              </tr>
            ) : (
              items.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-border last:border-b-0 transition-colors hover:bg-neutral-50"
                >
                  <td className="px-5 py-3 font-medium text-text-primary">{d.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-text-muted">
                    {new Date(d.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(d)}
                      className="rounded-md px-2.5 py-1.5 text-sm text-danger-fg hover:bg-danger-bg focus:outline-none focus-visible:shadow-focus"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete department?"
          body={
            <>
              <strong>{confirmDelete.name}</strong> will no longer appear in
              specialization pickers. Existing doctors keep their current
              specialization label.
            </>
          }
          confirmLabel="Delete"
          onConfirm={() => {
            const target = confirmDelete;
            setConfirmDelete(null);
            handleDelete(target);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// =====================================================================
//  Confirm dialog (local copy — shared component lives in /admin/users)
// =====================================================================

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
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
          <p>{body}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-neutral-50 px-6 py-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-[34px] items-center justify-center rounded-md border border-danger-solid bg-danger-solid px-4 text-sm font-medium text-white transition-colors hover:brightness-95"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
