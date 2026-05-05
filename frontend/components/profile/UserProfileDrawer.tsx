"use client";

/**
 * Shared profile-edit drawer used by /admin/users, /reception/users and
 * /doctor/patients. The actor-mode prop controls how saves are submitted:
 *
 *   admin       — direct PATCH /admin/users/:id/profile, every field editable
 *   receptionist — every field editable, save requires SMS code via verify modal
 *   doctor      — medical fields direct, non-medical require SMS code
 *
 * All three modes share the same Section/Field layout and dirty-diff logic.
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import type { BloodType, Gender, PatientProfile } from "@/lib/types";
import { VerifyCodeModal } from "./VerifyCodeModal";

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

/** Subset of fields a doctor can edit without an SMS code. */
const DOCTOR_MEDICAL_FIELDS = [
  "bloodType",
  "allergies",
  "chronicConditions",
  "currentMedications",
] as const;
type MedicalField = (typeof DOCTOR_MEDICAL_FIELDS)[number];

export type DrawerActor = "admin" | "receptionist" | "doctor";

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

function diffPatch(initial: FormState, current: FormState): Record<string, string | null> {
  const patch: Record<string, string | null> = {};
  (Object.keys(current) as (keyof FormState)[]).forEach((key) => {
    if (initial[key] === current[key]) return;
    const value = current[key];
    if (key === "gender" || key === "bloodType") {
      patch[key] = value;
    } else if (key === "dateOfBirth") {
      patch[key] = value === "" ? null : value;
    } else {
      patch[key] = value.trim() === "" ? null : value.trim();
    }
  });
  return patch;
}

function splitMedical(patch: Record<string, string | null>) {
  const medical: Record<string, string | null> = {};
  const other: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(patch)) {
    if ((DOCTOR_MEDICAL_FIELDS as readonly string[]).includes(k)) medical[k] = v;
    else other[k] = v;
  }
  return { medical, other };
}

interface CodeChallenge {
  requestId: string;
  expiresAt: string;
  phoneHint: string;
  provider: string;
  pendingForm: FormState;
}

interface UserProfileDrawerProps {
  userId: string;
  actor: DrawerActor;
  onClose: () => void;
  onUpdated?: (profile: PatientProfile) => void;
  /** Source-specific endpoints for fetching the target. Defaults follow the actor. */
  fetchPath?: string;
  /** Header label override (e.g. "Patient details" vs. "User details"). */
  title?: string;
}

export function UserProfileDrawer({
  userId,
  actor,
  onClose,
  onUpdated,
  fetchPath,
  title,
}: UserProfileDrawerProps) {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [initialForm, setInitialForm] = useState<FormState>(emptyForm());
  const [form, setForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<CodeChallenge | null>(null);

  const detailsPath = useMemo(() => {
    if (fetchPath) return fetchPath;
    if (actor === "admin") return `/admin/users/${userId}`;
    if (actor === "receptionist") return `/receptionist/users/${userId}`;
    return `/doctor/patients/${userId}/profile`;
  }, [actor, userId, fetchPath]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !challenge) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, challenge]);

  // Load the profile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await apiGet<PatientProfile>(detailsPath);
        if (cancelled) return;
        setProfile(p);
        const initial = profileToForm(p);
        setInitialForm(initial);
        setForm(initial);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load profile.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailsPath]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function applyUpdated(updated: PatientProfile) {
    setProfile(updated);
    const next = profileToForm(updated);
    setInitialForm(next);
    setForm(next);
    onUpdated?.(updated);
  }

  async function onSave() {
    const patch = diffPatch(initialForm, form);
    if (Object.keys(patch).length === 0) {
      toast.info("No changes to save.");
      return;
    }
    try {
      setSaving(true);
      if (actor === "admin") {
        const updated = await apiPatch<PatientProfile>(
          `/admin/users/${userId}/profile`,
          patch,
        );
        applyUpdated(updated);
        toast.success("Profile updated.");
      } else if (actor === "receptionist") {
        const res = await apiPost<{
          requestId: string;
          expiresAt: string;
          phoneHint: string;
          provider: string;
        }>(`/receptionist/users/${userId}/profile-changes/request`, patch);
        setChallenge({ ...res, pendingForm: form });
        toast.success(`Code sent (${res.provider}). Ask the patient for the 6-digit code.`);
      } else {
        // doctor
        const { medical, other } = splitMedical(patch);
        if (Object.keys(other).length === 0) {
          // Medical-only — direct save.
          const updated = await apiPatch<PatientProfile>(
            `/doctor/patients/${userId}/profile/medical`,
            medical,
          );
          applyUpdated(updated);
          toast.success("Medical fields updated.");
        } else {
          // Non-medical fields require a code. Save medical inline first if any.
          if (Object.keys(medical).length > 0) {
            const updated = await apiPatch<PatientProfile>(
              `/doctor/patients/${userId}/profile/medical`,
              medical,
            );
            applyUpdated(updated);
            toast.success("Medical fields saved. Verify the code to apply the rest.");
          }
          const res = await apiPost<{
            requestId: string;
            expiresAt: string;
            phoneHint: string;
            provider: string;
          }>(`/doctor/patients/${userId}/profile-changes/request`, other);
          setChallenge({ ...res, pendingForm: form });
        }
      }
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

  async function onVerify(code: string): Promise<{ ok: true } | { ok: false; reason: string; attemptsLeft?: number }> {
    if (!challenge) return { ok: false, reason: "No pending request." };
    const verifyPath =
      actor === "receptionist"
        ? `/receptionist/profile-changes/${challenge.requestId}/verify`
        : `/doctor/profile-changes/${challenge.requestId}/verify`;
    try {
      const updated = await apiPost<PatientProfile>(verifyPath, { code });
      applyUpdated(updated);
      setChallenge(null);
      toast.success("Profile updated.");
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError) {
        const details = err.details as { attemptsLeft?: number } | null;
        return {
          ok: false,
          reason: err.message || "Verification failed.",
          attemptsLeft: details?.attemptsLeft,
        };
      }
      return { ok: false, reason: "Verification failed." };
    }
  }

  function onCancelChallenge() {
    setChallenge(null);
  }

  const dirty = JSON.stringify(initialForm) !== JSON.stringify(form);

  // ─── Field permissions per actor ───
  function isFieldEditable(_field: keyof FormState): boolean {
    // All three actors can edit every field. The save path is what differs.
    return !loading && !saving;
  }

  function fieldHint(field: keyof FormState): string | undefined {
    if (actor !== "doctor") return undefined;
    if ((DOCTOR_MEDICAL_FIELDS as readonly string[]).includes(field)) {
      return undefined;
    }
    return "SMS code required";
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-profile-drawer-title"
        className="fixed inset-0 z-40 flex justify-end"
        style={{ background: "oklch(20% 0.04 248 / 0.25)" }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !challenge) onClose();
        }}
      >
        <aside className="flex h-full w-full max-w-[640px] flex-col border-l border-border bg-surface-raised shadow-overlay">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <div>
              <p className="font-mono text-2xs uppercase tracking-widest text-text-subtle">
                {actor === "admin" && "Admin"}
                {actor === "receptionist" && "Receptionist"}
                {actor === "doctor" && "Doctor"} ·{" "}
                {actor === "doctor" ? "Patient" : "User"} details
              </p>
              <h2
                id="user-profile-drawer-title"
                className="font-display text-xl font-normal text-text-primary"
                style={{ letterSpacing: "-0.01em" }}
              >
                {title ?? profile?.name ?? "Loading…"}
              </h2>
              {profile && (
                <p className="font-mono text-xs text-text-muted">{profile.email}</p>
              )}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-neutral-100 hover:text-text-primary"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading && (
              <div className="space-y-4">
                <div className="h-32 animate-pulse rounded-lg bg-neutral-100" />
                <div className="h-48 animate-pulse rounded-lg bg-neutral-100" />
                <div className="h-40 animate-pulse rounded-lg bg-neutral-100" />
              </div>
            )}
            {!loading && error && (
              <div className="rounded-md border border-danger-border bg-danger-bg p-4 text-sm text-danger-fg">
                {error}
              </div>
            )}
            {!loading && !error && profile && (
              <div className="space-y-5">
                {actor !== "admin" && (
                  <div className="rounded-md border border-info-border bg-info-bg px-3 py-2 text-xs text-info-fg">
                    {actor === "receptionist" && (
                      <>Edits are confirmed by a 6-digit code sent to the patient&apos;s phone.</>
                    )}
                    {actor === "doctor" && (
                      <>Medical fields (blood type, allergies, conditions, medications) save without a code. Other fields require a code sent to the patient&apos;s phone.</>
                    )}
                  </div>
                )}

                <Section title="Account" subtitle="Read-only.">
                  <Field label="Name">
                    <ReadOnly value={profile.name} />
                  </Field>
                  <Field label="Email">
                    <ReadOnly value={profile.email} />
                  </Field>
                </Section>

                <Section title="Contact">
                  <Field label="Phone" hint={fieldHint("phone")}>
                    <Input
                      value={form.phone}
                      onChange={(v) => update("phone", v)}
                      disabled={!isFieldEditable("phone")}
                      placeholder="+90 5XX XXX XXXX"
                    />
                  </Field>
                  <Field label="Address" wide hint={fieldHint("address")}>
                    <Input
                      value={form.address}
                      onChange={(v) => update("address", v)}
                      disabled={!isFieldEditable("address")}
                    />
                  </Field>
                  <Field label="City" hint={fieldHint("city")}>
                    <Input
                      value={form.city}
                      onChange={(v) => update("city", v)}
                      disabled={!isFieldEditable("city")}
                    />
                  </Field>
                  <Field label="Country" hint={fieldHint("country")}>
                    <Input
                      value={form.country}
                      onChange={(v) => update("country", v)}
                      disabled={!isFieldEditable("country")}
                    />
                  </Field>
                </Section>

                <Section title="Demographics">
                  <Field label="Date of birth" hint={fieldHint("dateOfBirth")}>
                    <input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) => update("dateOfBirth", e.target.value)}
                      disabled={!isFieldEditable("dateOfBirth")}
                      className="h-9 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-text-primary disabled:bg-neutral-50 disabled:text-text-muted"
                    />
                  </Field>
                  <Field label="Gender" hint={fieldHint("gender")}>
                    <Select
                      value={form.gender}
                      onChange={(v) => update("gender", v as Gender)}
                      options={GENDER_OPTIONS}
                      disabled={!isFieldEditable("gender")}
                    />
                  </Field>
                </Section>

                <Section title="Emergency contact">
                  <Field label="Full name" hint={fieldHint("emergencyContactName")}>
                    <Input
                      value={form.emergencyContactName}
                      onChange={(v) => update("emergencyContactName", v)}
                      disabled={!isFieldEditable("emergencyContactName")}
                    />
                  </Field>
                  <Field label="Phone" hint={fieldHint("emergencyContactPhone")}>
                    <Input
                      value={form.emergencyContactPhone}
                      onChange={(v) => update("emergencyContactPhone", v)}
                      disabled={!isFieldEditable("emergencyContactPhone")}
                    />
                  </Field>
                  <Field label="Relation" hint={fieldHint("emergencyContactRelation")}>
                    <Input
                      value={form.emergencyContactRelation}
                      onChange={(v) => update("emergencyContactRelation", v)}
                      disabled={!isFieldEditable("emergencyContactRelation")}
                    />
                  </Field>
                </Section>

                <Section
                  title="Medical information"
                  subtitle={
                    actor === "doctor"
                      ? "Save inline — no code required."
                      : undefined
                  }
                >
                  <Field label="Blood type">
                    <Select
                      value={form.bloodType}
                      onChange={(v) => update("bloodType", v as BloodType)}
                      options={BLOOD_TYPE_OPTIONS}
                      disabled={!isFieldEditable("bloodType")}
                    />
                  </Field>
                  <Field label="Allergies" wide>
                    <Textarea
                      value={form.allergies}
                      onChange={(v) => update("allergies", v)}
                      disabled={!isFieldEditable("allergies")}
                    />
                  </Field>
                  <Field label="Chronic conditions" wide>
                    <Textarea
                      value={form.chronicConditions}
                      onChange={(v) => update("chronicConditions", v)}
                      disabled={!isFieldEditable("chronicConditions")}
                    />
                  </Field>
                  <Field label="Current medications" wide>
                    <Textarea
                      value={form.currentMedications}
                      onChange={(v) => update("currentMedications", v)}
                      disabled={!isFieldEditable("currentMedications")}
                    />
                  </Field>
                </Section>

                <Section title="Identity & insurance">
                  <Field label="National ID" hint={fieldHint("nationalId")}>
                    <Input
                      value={form.nationalId}
                      onChange={(v) => update("nationalId", v)}
                      disabled={!isFieldEditable("nationalId")}
                    />
                  </Field>
                  <Field label="Insurance provider" hint={fieldHint("insuranceProvider")}>
                    <Input
                      value={form.insuranceProvider}
                      onChange={(v) => update("insuranceProvider", v)}
                      disabled={!isFieldEditable("insuranceProvider")}
                    />
                  </Field>
                  <Field label="Insurance policy number" hint={fieldHint("insurancePolicyNumber")}>
                    <Input
                      value={form.insurancePolicyNumber}
                      onChange={(v) => update("insurancePolicyNumber", v)}
                      disabled={!isFieldEditable("insurancePolicyNumber")}
                    />
                  </Field>
                </Section>
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && !error && profile && (
            <div className="flex items-center justify-between gap-3 border-t border-border bg-neutral-50 px-6 py-3">
              <p className="text-xs text-text-muted">
                {dirty ? "Unsaved changes." : "All changes saved."}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose} disabled={saving}>
                  Close
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setForm(initialForm)}
                  disabled={!dirty || saving}
                >
                  Discard
                </Button>
                <Button onClick={onSave} disabled={!dirty} loading={saving}>
                  {actor === "admin" ? "Save changes" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {challenge && (
        <VerifyCodeModal
          phoneHint={challenge.phoneHint}
          provider={challenge.provider}
          expiresAt={challenge.expiresAt}
          onVerify={onVerify}
          onCancel={onCancelChallenge}
        />
      )}
    </>
  );
}

// ─── Layout primitives (mirrors patient/profile editor) ────────────────────

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
    <section className="rounded-md border border-border bg-surface-raised p-4">
      <div className="mb-3">
        <h3 className="font-display text-md font-medium text-text-primary">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
  wide = false,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-2xs font-medium uppercase tracking-wide text-text-subtle">
          {label}
        </span>
        {hint && (
          <span className="font-mono text-2xs uppercase tracking-widest text-warning-fg">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="h-9 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-text-primary placeholder:text-text-subtle focus:outline-none focus-visible:shadow-focus disabled:bg-neutral-50 disabled:text-text-muted"
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={3}
      className="w-full resize-y rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-subtle focus:outline-none focus-visible:shadow-focus disabled:bg-neutral-50 disabled:text-text-muted"
    />
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      disabled={disabled}
      className="h-9 w-full rounded-md border border-border-strong bg-surface-raised px-2 text-sm text-text-primary focus:outline-none focus-visible:shadow-focus disabled:bg-neutral-50 disabled:text-text-muted"
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
