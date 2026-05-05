"use client";

import { useEffect, useState, FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { apiGet, apiPatch, ApiError } from "@/lib/api";
import type { PatientProfile, Gender, BloodType } from "@/lib/types";

/**
 * Patient self-service profile editor.
 *
 * Loads GET /api/profile on mount, then PATCHes only the changed fields back
 * on save. The server treats "" / null on free-text fields as "clear", so the
 * UI uses controlled empty strings; we send `null` on save where appropriate.
 */

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
  { value: "UNDISCLOSED", label: "Prefer not to say" },
];

const BLOOD_TYPE_OPTIONS: { value: BloodType; label: string }[] = [
  { value: "UNKNOWN", label: "Unknown" },
  { value: "A_POSITIVE", label: "A+" },
  { value: "A_NEGATIVE", label: "A-" },
  { value: "B_POSITIVE", label: "B+" },
  { value: "B_NEGATIVE", label: "B-" },
  { value: "AB_POSITIVE", label: "AB+" },
  { value: "AB_NEGATIVE", label: "AB-" },
  { value: "O_POSITIVE", label: "O+" },
  { value: "O_NEGATIVE", label: "O-" },
];

/** Form-state mirror of PatientProfile that uses "" instead of null. */
interface FormState {
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  address: string;
  city: string;
  country: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  bloodType: BloodType;
  allergies: string;
  chronicConditions: string;
  currentMedications: string;
  nationalId: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
}

function emptyForm(): FormState {
  return {
    phone: "",
    dateOfBirth: "",
    gender: "UNDISCLOSED",
    address: "",
    city: "",
    country: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    bloodType: "UNKNOWN",
    allergies: "",
    chronicConditions: "",
    currentMedications: "",
    nationalId: "",
    insuranceProvider: "",
    insurancePolicyNumber: "",
  };
}

function profileToForm(p: PatientProfile): FormState {
  return {
    phone: p.phone ?? "",
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : "",
    gender: p.gender,
    address: p.address ?? "",
    city: p.city ?? "",
    country: p.country ?? "",
    emergencyContactName: p.emergencyContactName ?? "",
    emergencyContactPhone: p.emergencyContactPhone ?? "",
    emergencyContactRelation: p.emergencyContactRelation ?? "",
    bloodType: p.bloodType,
    allergies: p.allergies ?? "",
    chronicConditions: p.chronicConditions ?? "",
    currentMedications: p.currentMedications ?? "",
    nationalId: p.nationalId ?? "",
    insuranceProvider: p.insuranceProvider ?? "",
    insurancePolicyNumber: p.insurancePolicyNumber ?? "",
  };
}

/** Build PATCH body containing only fields that changed vs. the loaded profile. */
function diffPatch(initial: FormState, current: FormState): Record<string, string | null> {
  const patch: Record<string, string | null> = {};
  (Object.keys(current) as (keyof FormState)[]).forEach((key) => {
    if (initial[key] === current[key]) return;
    const value = current[key];
    if (key === "gender" || key === "bloodType") {
      // Enum fields: never null, always pass the value through
      patch[key] = value;
    } else if (key === "dateOfBirth") {
      patch[key] = value === "" ? null : value;
    } else {
      // Free-text fields: empty string -> null (clear)
      patch[key] = value.trim() === "" ? null : value.trim();
    }
  });
  return patch;
}

export default function PatientProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [initialForm, setInitialForm] = useState<FormState>(emptyForm());
  const [form, setForm] = useState<FormState>(emptyForm());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const p = await apiGet<PatientProfile>("/profile");
        if (cancelled) return;
        setProfile(p);
        const initial = profileToForm(p);
        setInitialForm(initial);
        setForm(initial);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const patch = diffPatch(initialForm, form);
    if (Object.keys(patch).length === 0) {
      toast.info("No changes to save.");
      return;
    }
    try {
      setSaving(true);
      const updated = await apiPatch<PatientProfile>("/profile", patch);
      setProfile(updated);
      const next = profileToForm(updated);
      setInitialForm(next);
      setForm(next);
      toast.success("Profile updated.");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Save failed.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    setForm(initialForm);
    toast.info("Reverted unsaved changes.");
  }

  const dirty = JSON.stringify(initialForm) !== JSON.stringify(form);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-200" />
        <div className="h-96 animate-pulse rounded-lg border border-border bg-surface-raised" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <p className="font-medium">{error}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-2xs uppercase tracking-widest text-text-subtle">
          Patient · Profile
        </p>
        <h1
          className="font-display text-3xl font-normal text-text-primary"
          style={{ letterSpacing: "-0.02em" }}
        >
          Your information
        </h1>
        <p className="max-w-[60ch] text-sm text-text-muted">
          Keep your contact, emergency and medical information up to date so doctors and
          reception can reach you when needed.
        </p>
      </header>

      {/* Account (read-only) */}
      <Section title="Account" subtitle="Managed by the system. Contact an admin to change your name or email.">
        <Field label="Name">
          <ReadOnly value={profile?.name ?? ""} />
        </Field>
        <Field label="Email">
          <ReadOnly value={profile?.email ?? ""} />
        </Field>
      </Section>

      {/* Contact */}
      <Section title="Contact">
        <Field label="Phone">
          <Input
            value={form.phone}
            onChange={(v) => update("phone", v)}
            placeholder="+90 5XX XXX XXXX"
          />
        </Field>
        <Field label="Address" wide>
          <Input value={form.address} onChange={(v) => update("address", v)} />
        </Field>
        <Field label="City">
          <Input value={form.city} onChange={(v) => update("city", v)} />
        </Field>
        <Field label="Country">
          <Input value={form.country} onChange={(v) => update("country", v)} />
        </Field>
      </Section>

      {/* Demographics */}
      <Section title="Demographics">
        <Field label="Date of birth">
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => update("dateOfBirth", e.target.value)}
            className="h-9 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-text-primary"
          />
        </Field>
        <Field label="Gender">
          <Select
            value={form.gender}
            onChange={(v) => update("gender", v as Gender)}
            options={GENDER_OPTIONS}
          />
        </Field>
      </Section>

      {/* Emergency contact */}
      <Section
        title="Emergency contact"
        subtitle="Who should we contact if you need urgent care?"
      >
        <Field label="Full name">
          <Input
            value={form.emergencyContactName}
            onChange={(v) => update("emergencyContactName", v)}
          />
        </Field>
        <Field label="Phone">
          <Input
            value={form.emergencyContactPhone}
            onChange={(v) => update("emergencyContactPhone", v)}
            placeholder="+90 5XX XXX XXXX"
          />
        </Field>
        <Field label="Relation">
          <Input
            value={form.emergencyContactRelation}
            onChange={(v) => update("emergencyContactRelation", v)}
            placeholder="e.g. Spouse, Parent"
          />
        </Field>
      </Section>

      {/* Medical */}
      <Section
        title="Medical information"
        subtitle="Visible to your doctors during appointments."
      >
        <Field label="Blood type">
          <Select
            value={form.bloodType}
            onChange={(v) => update("bloodType", v as BloodType)}
            options={BLOOD_TYPE_OPTIONS}
          />
        </Field>
        <Field label="Allergies" wide>
          <Textarea
            value={form.allergies}
            onChange={(v) => update("allergies", v)}
            placeholder="e.g. Penicillin, peanuts"
          />
        </Field>
        <Field label="Chronic conditions" wide>
          <Textarea
            value={form.chronicConditions}
            onChange={(v) => update("chronicConditions", v)}
            placeholder="e.g. Asthma, diabetes"
          />
        </Field>
        <Field label="Current medications" wide>
          <Textarea
            value={form.currentMedications}
            onChange={(v) => update("currentMedications", v)}
            placeholder="One per line"
          />
        </Field>
      </Section>

      {/* Identity & insurance */}
      <Section
        title="Identity & insurance"
        subtitle="Used for billing and identification at the clinic."
      >
        <Field label="National ID">
          <Input
            value={form.nationalId}
            onChange={(v) => update("nationalId", v)}
            placeholder="TC kimlik / passport"
          />
        </Field>
        <Field label="Insurance provider">
          <Input
            value={form.insuranceProvider}
            onChange={(v) => update("insuranceProvider", v)}
          />
        </Field>
        <Field label="Insurance policy number">
          <Input
            value={form.insurancePolicyNumber}
            onChange={(v) => update("insurancePolicyNumber", v)}
          />
        </Field>
      </Section>

      <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-3 border-t border-border bg-surface-raised px-6 py-4">
        <p className="text-xs text-text-muted">
          {dirty ? "You have unsaved changes." : "All changes saved."}
        </p>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={!dirty || saving}
            onClick={onReset}
          >
            Discard
          </Button>
          <Button type="submit" disabled={!dirty} loading={saving}>
            Save changes
          </Button>
        </div>
      </div>
    </form>
  );
}

// ─── Small layout primitives (file-local) ──────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface-raised p-6 shadow-xs">
      <div className="mb-4">
        <h2 className="font-display text-lg font-medium text-text-primary">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-text-muted">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-text-subtle">
        {label}
      </span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-text-primary placeholder:text-text-subtle focus:outline-none focus-visible:shadow-focus"
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className="w-full resize-y rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-subtle focus:outline-none focus-visible:shadow-focus"
    />
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-9 w-full rounded-md border border-border-strong bg-surface-raised px-2 text-sm text-text-primary focus:outline-none focus-visible:shadow-focus"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ReadOnly({ value }: { value: string }) {
  return (
    <div className="h-9 w-full rounded-md border border-border bg-neutral-50 px-3 text-sm leading-9 text-text-muted">
      {value || "—"}
    </div>
  );
}
