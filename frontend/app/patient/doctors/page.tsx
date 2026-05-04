"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import type { Doctor, Paginated } from "@/lib/types";

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

const SPECIALIZATIONS = [
  "Cardiology",
  "Dermatology",
  "Neurology",
  "Pediatrics",
  "Psychiatry",
  "General Practice",
];

export default function BrowseDoctorsPage() {
  const router = useRouter();

  // --- State Tanımlamaları ---
  const [data, setData] = useState<Paginated<Doctor> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtreler
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300); // 300ms debounce
  const [specialization, setSpecialization] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 9; // Grid yapısına uygun 3x3 veya 3 sütunlu görünüm için

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

      // Hasan/Taha'nın yazdığı apiGet wrapper'ını kullanıyoruz
      const res = await apiGet<Paginated<Doctor>>(`/doctors?${params.toString()}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load doctors. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, specialization]);

  // Filtreler değişince sayfayı 1'e sıfırla
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, specialization]);

  // Sayfa veya filtreler değişince datayı çek
  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  return (
    <div className="space-y-8">
      {/* --- Üst Kısım: Başlık ve Filtreler --- */}
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
            Patient · Doctors
          </p>
          <h1 className="page-title font-display text-4xl font-normal text-text-primary" style={{ letterSpacing: "-0.02em" }}>
            Browse Doctors
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search by name..."
            className="h-10 rounded-md border border-border bg-surface-base px-3 text-sm text-text-primary focus:border-border-strong focus:outline-none focus:ring-1 focus:ring-border-strong"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="h-10 rounded-md border border-border bg-surface-base px-3 text-sm text-text-primary focus:border-border-strong focus:outline-none focus:ring-1 focus:ring-border-strong"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
          >
            <option value="">All Specializations</option>
            {SPECIALIZATIONS.map((spec) => (
              <option key={spec} value={spec}>
                {spec}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* --- Durum Yönetimi (Error, Loading, Empty State) --- */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600 flex items-center justify-between">
          <span className="text-sm font-medium">{error}</span>
          <Button variant="outline" onClick={fetchDoctors}>Retry</Button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
          <p className="mt-2 text-sm text-text-muted">Try adjusting your search criteria or removing filters.</p>
        </section>
      ) : (
        <>
          {/* --- Doktor Kartları Grid --- */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data?.items.map((doctor) => (
              <div
                key={doctor.id}
                onClick={() => router.push(`/patient/doctors/${doctor.id}`)}
                className="group flex cursor-pointer flex-col justify-between rounded-lg border border-border bg-surface-raised p-6 shadow-sm transition-all hover:border-border-strong hover:shadow-md"
              >
                <div>
                  <h3 className="font-display text-xl font-medium text-text-primary group-hover:text-blue-600 transition-colors">
                    {doctor.user.name}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-text-muted">
                    {doctor.specialization}
                  </p>
                  <p className="mt-4 text-sm text-text-muted line-clamp-3">
                    {doctor.bio || "No biography provided for this doctor."}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* --- Pagination Kontrolleri --- */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-6">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm font-medium text-text-muted">
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page === data.totalPages}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}