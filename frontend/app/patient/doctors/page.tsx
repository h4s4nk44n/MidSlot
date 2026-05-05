"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import type { Doctor, Gender, Paginated } from "@/lib/types";
import { DOCTOR_TITLES, doctorDisplayName, type DoctorTitle } from "@/lib/doctor-name";

// --- Debounce Hook (Kullanıcı her harf yazdığında API'yi yormamak için) ---
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

interface Department {
  id: string;
  name: string;
}

// Filter values exposed to patients (UNDISCLOSED is intentionally excluded —
// patients shouldn't filter to "no answer").
type GenderFilter = "ALL" | Exclude<Gender, "UNDISCLOSED">;
type TitleFilter = "ALL" | DoctorTitle;

const GENDER_OPTIONS: { value: GenderFilter; label: string }[] = [
  { value: "ALL", label: "Any gender" },
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "OTHER", label: "Other" },
];

// Reasonable defaults for the age range slider; matches backend bounds.
const AGE_MIN = 25;
const AGE_MAX = 80;

// Compute integer age from an ISO dateOfBirth string.
function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function BrowseDoctorsPage() {
  const router = useRouter();

  // --- State Tanımlamaları ---
  const [data, setData] = useState<Paginated<Doctor> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [specializations, setSpecializations] = useState<string[]>([]);

  // Filtreler
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [specialization, setSpecialization] = useState("");
  const [title, setTitle] = useState<TitleFilter>("ALL");
  const [gender, setGender] = useState<GenderFilter>("ALL");
  const [ageMin, setAgeMin] = useState<number>(AGE_MIN);
  const [ageMax, setAgeMax] = useState<number>(AGE_MAX);
  const [page, setPage] = useState(1);
  const pageSize = 9;

  // --- API İsteği ---
  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (debouncedSearch) params.append("q", debouncedSearch);
      if (specialization) params.append("specialization", specialization);
      if (title !== "ALL") params.append("title", title);
      if (gender !== "ALL") params.append("gender", gender);
      // Only send age bounds when the user has narrowed away from defaults —
      // keeps the URL clean and avoids excluding doctors with unknown DOB
      // unnecessarily.
      if (ageMin > AGE_MIN) params.append("ageMin", String(ageMin));
      if (ageMax < AGE_MAX) params.append("ageMax", String(ageMax));

      const res = await apiGet<Paginated<Doctor>>(`/doctors?${params.toString()}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load doctors. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, specialization, title, gender, ageMin, ageMax]);

  // Filtreler değişince sayfayı 1'e sıfırla
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, specialization, title, gender, ageMin, ageMax]);

  // Load department list once for the filter sidebar.
  useEffect(() => {
    let cancelled = false;
    apiGet<Department[]>("/departments")
      .then((res) => {
        if (!cancelled) setSpecializations(res.map((d) => d.name));
      })
      .catch(() => {
        // Non-critical: leaving the dropdown empty just falls back to "All".
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sayfa veya filtreler değişince datayı çek
  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const resetFilters = () => {
    setSearch("");
    setSpecialization("");
    setTitle("ALL");
    setGender("ALL");
    setAgeMin(AGE_MIN);
    setAgeMax(AGE_MAX);
  };

  const activeFilterCount =
    (debouncedSearch ? 1 : 0) +
    (specialization ? 1 : 0) +
    (title !== "ALL" ? 1 : 0) +
    (gender !== "ALL" ? 1 : 0) +
    (ageMin > AGE_MIN || ageMax < AGE_MAX ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
          Patient · Doctors
        </p>
        <h1
          className="page-title font-display text-4xl font-normal text-text-primary"
          style={{ letterSpacing: "-0.02em" }}
        >
          Browse Doctors
        </h1>
      </header>

      {/* Two-column layout: filters sidebar + results grid */}
      <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
        {/* --- Filter sidebar --- */}
        <aside
          aria-label="Doctor filters"
          className="sticky top-6 self-start rounded-md border border-border bg-surface-raised"
        >
          <div className="flex items-center justify-between rounded-t-md border-b border-border bg-surface-sunken px-4 py-2.5">
            <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
              Filters
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="font-mono text-2xs uppercase tracking-widest text-text-link hover:underline"
              >
                Clear ({activeFilterCount})
              </button>
            )}
          </div>

          <div className="space-y-5 p-4">
            {/* Name */}
            <FilterGroup label="Name">
              <input
                type="search"
                placeholder="Search by name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-md border border-border-strong bg-surface-raised px-2.5 text-sm text-text-body placeholder:text-text-subtle focus:border-primary-500 focus:outline-none focus-visible:shadow-focus"
              />
            </FilterGroup>

            {/* Specialization */}
            <FilterGroup label="Specialization">
              <select
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="h-9 w-full rounded-md border border-border-strong bg-surface-raised px-2 text-sm text-text-body focus:border-primary-500 focus:outline-none focus-visible:shadow-focus"
              >
                <option value="">All specializations</option>
                {specializations.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </FilterGroup>

            {/* Title */}
            <FilterGroup label="Title">
              <select
                value={title}
                onChange={(e) => setTitle(e.target.value as TitleFilter)}
                className="h-9 w-full rounded-md border border-border-strong bg-surface-raised px-2 text-sm text-text-body focus:border-primary-500 focus:outline-none focus-visible:shadow-focus"
              >
                <option value="ALL">Any title</option>
                {DOCTOR_TITLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </FilterGroup>

            {/* Gender */}
            <FilterGroup label="Gender">
              <div className="space-y-1.5">
                {GENDER_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-2 text-sm text-text-body"
                  >
                    <input
                      type="radio"
                      name="gender"
                      value={opt.value}
                      checked={gender === opt.value}
                      onChange={() => setGender(opt.value)}
                      className="h-3.5 w-3.5 accent-primary-700"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </FilterGroup>

            {/* Age range */}
            <FilterGroup
              label={
                ageMin > AGE_MIN || ageMax < AGE_MAX
                  ? `Age (${ageMin}–${ageMax})`
                  : "Age"
              }
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={AGE_MIN}
                    max={ageMax}
                    value={ageMin}
                    onChange={(e) => {
                      const v = Math.max(
                        AGE_MIN,
                        Math.min(ageMax, Number(e.target.value) || AGE_MIN),
                      );
                      setAgeMin(v);
                    }}
                    aria-label="Minimum age"
                    className="h-9 w-full rounded-md border border-border-strong bg-surface-raised px-2 text-sm text-text-body focus:border-primary-500 focus:outline-none focus-visible:shadow-focus"
                  />
                  <span className="font-mono text-2xs text-text-subtle">to</span>
                  <input
                    type="number"
                    min={ageMin}
                    max={AGE_MAX}
                    value={ageMax}
                    onChange={(e) => {
                      const v = Math.min(
                        AGE_MAX,
                        Math.max(ageMin, Number(e.target.value) || AGE_MAX),
                      );
                      setAgeMax(v);
                    }}
                    aria-label="Maximum age"
                    className="h-9 w-full rounded-md border border-border-strong bg-surface-raised px-2 text-sm text-text-body focus:border-primary-500 focus:outline-none focus-visible:shadow-focus"
                  />
                </div>
              </div>
            </FilterGroup>
          </div>
        </aside>

        {/* --- Results column --- */}
        <section className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600 flex items-center justify-between">
              <span className="text-sm font-medium">{error}</span>
              <Button variant="secondary" onClick={fetchDoctors}>Retry</Button>
            </div>
          )}

          {!error && (
            <p className="font-mono text-2xs uppercase tracking-widest text-text-subtle">
              {loading
                ? "Loading…"
                : data && data.total > 0
                  ? `${data.total} doctor${data.total === 1 ? "" : "s"} found`
                  : "No matches"}
            </p>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-border bg-surface-raised p-6">
                  <div className="h-6 w-3/4 rounded bg-neutral-200 mb-2"></div>
                  <div className="h-4 w-1/2 rounded bg-neutral-200 mb-4"></div>
                  <div className="h-16 w-full rounded bg-neutral-100"></div>
                </div>
              ))}
            </div>
          ) : data?.items.length === 0 ? (
            <section className="rounded-lg border border-border bg-surface-raised p-12 text-center shadow-xs">
              <h2 className="font-display text-lg font-medium text-text-primary">No doctors found</h2>
              <p className="mt-2 text-sm text-text-muted">Try adjusting your filters or clearing some criteria.</p>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 inline-flex items-center text-sm font-medium text-text-link hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </section>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {data?.items.map((doctor) => {
                  const age = ageFromDob(doctor.dateOfBirth ?? null);
                  return (
                    <div
                      key={doctor.id}
                      onClick={() => router.push(`/patient/doctors/${doctor.id}`)}
                      className="group flex cursor-pointer flex-col justify-between rounded-lg border border-border bg-surface-raised p-6 shadow-sm transition-all hover:border-border-strong hover:shadow-md"
                    >
                      <div>
                        <h3 className="font-display text-xl font-medium text-text-primary group-hover:text-blue-600 transition-colors">
                          {doctorDisplayName(doctor.user.name, doctor.title)}
                        </h3>
                        <p className="mt-1 text-sm font-medium text-text-muted">
                          {doctor.specialization}
                        </p>
                        {(age !== null || (doctor.gender && doctor.gender !== "UNDISCLOSED")) && (
                          <p className="mt-1 font-mono text-2xs uppercase tracking-widest text-text-subtle">
                            {[
                              age !== null ? `${age} yrs` : null,
                              doctor.gender && doctor.gender !== "UNDISCLOSED"
                                ? doctor.gender.charAt(0) + doctor.gender.slice(1).toLowerCase()
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                        <p className="mt-4 text-sm text-text-muted line-clamp-3">
                          {doctor.bio || "No biography provided for this doctor."}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {data && data.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-6">
                  <Button
                    variant="secondary"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm font-medium text-text-muted">
                    Page {data.page} of {data.totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={page === data.totalPages}
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// =====================================================================
//  Sub-components
// =====================================================================

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
        {label}
      </label>
      {children}
    </div>
  );
}
