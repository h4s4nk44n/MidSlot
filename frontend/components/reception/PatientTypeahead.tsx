"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { searchPatients } from "@/lib/receptionist-api";
import type { PatientResult } from "@/lib/receptionist-api";

interface PatientTypeaheadProps {
  value: PatientResult | null;
  onChange: (patient: PatientResult | null) => void;
}

export function PatientTypeahead({ value, onChange }: PatientTypeaheadProps) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<PatientResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If parent clears value, reset input
  useEffect(() => {
    if (!value) setQuery("");
  }, [value]);

  const runSearch = useCallback((q: string) => {
    if (abortRef.current) abortRef.current.abort();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    searchPatients(q, ctrl.signal)
      .then((data) => {
        setResults(data);
        setOpen(true);
        setActiveIndex(-1);
      })
      .catch(() => {
        // aborted — ignore
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    onChange(null); // clear confirmed selection on edit
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 280);
  };

  const handleSelect = (p: PatientResult) => {
    onChange(p);
    setQuery(p.name);
    setOpen(false);
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Close on outside click
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const confirmed = !!value;

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `pt-option-${activeIndex}` : undefined}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Search by name or email…"
          className={[
            "w-full rounded-md border py-2 pl-3 pr-9 text-sm transition-colors",
            "focus:outline-none focus:ring-1",
            confirmed
              ? "border-sage-300 bg-sage-50 focus:border-sage-500 focus:ring-sage-500"
              : "border-border focus:border-primary-600 focus:ring-primary-600",
          ].join(" ")}
        />
        {/* Status icon */}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
          {loading ? (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : confirmed ? (
            <svg className="h-4 w-4 text-sage-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </div>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-surface-raised shadow-overlay"
        >
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-text-muted">
              No matching patient found.
            </li>
          ) : (
            results.map((p, i) => (
              <li
                key={p.id}
                id={`pt-option-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                onPointerDown={(e) => { e.preventDefault(); handleSelect(p); }}
                className={[
                  "flex cursor-pointer flex-col px-3 py-2.5 transition-colors",
                  i === activeIndex ? "bg-primary-50 text-primary-700" : "text-text-body hover:bg-neutral-50",
                ].join(" ")}
              >
                <span className="font-medium">{p.name}</span>
                <span className={`text-xs ${i === activeIndex ? "text-primary-500" : "text-text-muted"}`}>
                  {p.email}
                </span>
              </li>
            ))
          )}
        </ul>
      )}

      {confirmed && value && (
        <p className="mt-1.5 font-mono text-2xs font-medium uppercase tracking-widest text-sage-700">
          Patient confirmed · {value.email}
        </p>
      )}
    </div>
  );
}
