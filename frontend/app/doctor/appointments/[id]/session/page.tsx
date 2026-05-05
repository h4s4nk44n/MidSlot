"use client";

/**
 * /doctor/appointments/[id]/session — in-person visit workspace.
 *
 * Loaded after the doctor clicks "Start Appointment" (or "Open Session" from
 * a session that's already in progress). Surfaces the patient's full profile
 * minus insurance fields, lets the doctor patch contact / demographics /
 * emergency contact / medical info inline, and wraps the doctor's clinical
 * note editor.
 *
 * Session window: open from startedAt until (endedAt ?? slot.endTime) + 10 min.
 * The backend enforces this on every write; the UI mirrors it for affordance.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost, apiPut, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";

const NOTE_MAX_LENGTH = 4000;
const ACTIVE_WINDOW_BUFFER_MS = 10 * 60 * 1000;

type AppointmentStatus = "BOOKED" | "CANCELLED" | "COMPLETED";

type Gender = "MALE" | "FEMALE" | "OTHER" | "UNDISCLOSED";
type BloodType =
  | "A_POSITIVE" | "A_NEGATIVE" | "B_POSITIVE" | "B_NEGATIVE"
  | "AB_POSITIVE" | "AB_NEGATIVE" | "O_POSITIVE" | "O_NEGATIVE" | "UNKNOWN";

const GENDERS: Gender[] = ["MALE", "FEMALE", "OTHER", "UNDISCLOSED"];
const BLOOD_TYPES: BloodType[] = [
  "A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE",
  "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE", "UNKNOWN",
];

interface SessionPatient {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: Gender;
  address: string | null;
  city: string | null;
  country: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  bloodType: BloodType;
  allergies: string | null;
  chronicConditions: string | null;
  currentMedications: string | null;
  nationalId: string | null;
}

interface SessionPayload {
  id: string;
  status: AppointmentStatus;
  notes: string | null;
  doctorNote: string | null;
  startedAt: string | null;
  endedAt: string | null;
  timeSlot: { startTime: string; endTime: string };
  patient: SessionPatient;
}

/** Fields the form binds to (string-or-empty rather than nullable for input ergonomics). */
type EditableForm = {
  phone: string;
  dateOfBirth: string; // yyyy-mm-dd
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
};

function patientToForm(p: SessionPatient): EditableForm {
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
  };
}

/** Build a PATCH body containing only the fields whose value differs from baseline. */
function diffPatch(form: EditableForm, baseline: EditableForm): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(form) as (keyof EditableForm)[]) {
    if (form[key] !== baseline[key]) {
      const v = form[key];
      if (key === "gender" || key === "bloodType") {
        out[key] = v;
      } else if (key === "dateOfBirth") {
        out[key] = v === "" ? null : v;
      } else {
        out[key] = v === "" ? null : v;
      }
    }
  }
  return out;
}

export default function DoctorSessionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const appointmentId = params.id;

  const [data, setData] = useState<SessionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<EditableForm | null>(null);
  const [baseline, setBaseline] = useState<EditableForm | null>(null);
  const [saving, setSaving] = useState(false);

  const [note, setNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const [ending, setEnding] = useState(false);

  // Tick once a minute so window-closed UI updates on its own.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const fetchSession = useCallback(async () => {
    setError(null);
    try {
      const res = await apiGet<SessionPayload>(`/doctor/appointments/${appointmentId}/session`);
      setData(res);
      const f = patientToForm(res.patient);
      setForm(f);
      setBaseline(f);
      setNote(res.doctorNote ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load the session.");
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Editable iff: started + within (endedAt ?? slot.endTime) + 10min + status BOOKED.
  const sessionOpen = useMemo(() => {
    if (!data || !data.startedAt) return false;
    if (data.status !== "BOOKED") return false;
    const ref = data.endedAt ? new Date(data.endedAt) : new Date(data.timeSlot.endTime);
    return now <= new Date(ref.getTime() + ACTIVE_WINDOW_BUFFER_MS);
  }, [data, now]);

  const dirty = useMemo(() => {
    if (!form || !baseline) return false;
    return Object.keys(diffPatch(form, baseline)).length > 0;
  }, [form, baseline]);

  const handleSaveProfile = async () => {
    if (!form || !baseline) return;
    const body = diffPatch(form, baseline);
    if (Object.keys(body).length === 0) return;
    setSaving(true);
    try {
      await apiPatch(`/doctor/appointments/${appointmentId}/session/patient`, body);
      toast.success("Patient profile updated.");
      await fetchSession();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNote = async () => {
    setNoteSaving(true);
    try {
      await apiPut(`/doctor/appointments/${appointmentId}/note`, { note });
      toast.success("Note saved.");
      await fetchSession();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save the note.");
    } finally {
      setNoteSaving(false);
    }
  };

  const handleEnd = async () => {
    if (!window.confirm("End this appointment? It will be marked completed.")) return;
    setEnding(true);
    try {
      await apiPost(`/doctor/appointments/${appointmentId}/end`);
      toast.success("Appointment ended.");
      await fetchSession();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to end appointment.");
    } finally {
      setEnding(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-72 animate-pulse rounded bg-neutral-100" />
        <div className="h-4 w-96 animate-pulse rounded bg-neutral-100" />
        <div className="h-72 w-full animate-pulse rounded-lg bg-neutral-100" />
      </div>
    );
  }

  if (error || !data || !form) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push("/doctor/appointments")}
          className="font-mono text-xs uppercase tracking-widest text-text-muted hover:text-text-primary"
        >
          &larr; Back to appointments
        </button>
        <div role="alert" className="rounded-md border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg">
          {error ?? "Session not available."}
        </div>
      </div>
    );
  }

  const slotStart = new Date(data.timeSlot.startTime);
  const slotEnd = new Date(data.timeSlot.endTime);
  const fmt = (d: Date) =>
    d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <button
          onClick={() => router.push("/doctor/appointments")}
          className="font-mono text-xs uppercase tracking-widest text-text-muted hover:text-text-primary"
        >
          &larr; Back to appointments
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <h1
            className="font-display text-3xl font-normal text-text-primary"
            style={{ letterSpacing: "-0.015em" }}
          >
            Session with <em>{data.patient.name}</em>
          </h1>
          <SessionBadge data={data} sessionOpen={sessionOpen} />
        </div>
        <p className="text-sm text-text-muted">
          {fmt(slotStart)} &middot; ends {slotEnd.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          {data.startedAt && (
            <> &middot; started {new Date(data.startedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</>
          )}
          {data.endedAt && (
            <> &middot; ended {new Date(data.endedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</>
          )}
        </p>
        {!sessionOpen && data.status === "BOOKED" && data.startedAt && (
          <p className="text-xs text-amber-700">
            The 10-minute edit window has closed. Profile and note are now read-only.
          </p>
        )}
        {data.status === "COMPLETED" && (
          <p className="text-xs text-text-muted">This appointment is completed. Profile and note are read-only.</p>
        )}
      </header>

      {/* Patient header card — read-only identity */}
      <section className="rounded-lg border border-border bg-surface-raised p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ReadField label="Email" value={data.patient.email} mono />
          <ReadField label="National ID" value={data.patient.nationalId ?? "—"} mono />
          <ReadField
            label="Date of birth"
            value={data.patient.dateOfBirth ? new Date(data.patient.dateOfBirth).toLocaleDateString() : "—"}
          />
        </div>
      </section>

      {/* Editable form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSaveProfile();
        }}
        className="space-y-6"
      >
        <Section title="Contact">
          <Field label="Phone">
            <Input value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} disabled={!sessionOpen} />
          </Field>
          <Field label="Address" full>
            <Input value={form.address} onChange={(v) => setForm({ ...form, address: v })} disabled={!sessionOpen} />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(v) => setForm({ ...form, city: v })} disabled={!sessionOpen} />
          </Field>
          <Field label="Country">
            <Input value={form.country} onChange={(v) => setForm({ ...form, country: v })} disabled={!sessionOpen} />
          </Field>
        </Section>

        <Section title="Demographics">
          <Field label="Date of birth">
            <Input
              type="date"
              value={form.dateOfBirth}
              onChange={(v) => setForm({ ...form, dateOfBirth: v })}
              disabled={!sessionOpen}
            />
          </Field>
          <Field label="Gender">
            <Select
              value={form.gender}
              onChange={(v) => setForm({ ...form, gender: v as Gender })}
              options={GENDERS.map((g) => ({ value: g, label: g.charAt(0) + g.slice(1).toLowerCase() }))}
              disabled={!sessionOpen}
            />
          </Field>
        </Section>

        <Section title="Emergency contact">
          <Field label="Name">
            <Input
              value={form.emergencyContactName}
              onChange={(v) => setForm({ ...form, emergencyContactName: v })}
              disabled={!sessionOpen}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.emergencyContactPhone}
              onChange={(v) => setForm({ ...form, emergencyContactPhone: v })}
              disabled={!sessionOpen}
            />
          </Field>
          <Field label="Relationship">
            <Input
              value={form.emergencyContactRelation}
              onChange={(v) => setForm({ ...form, emergencyContactRelation: v })}
              disabled={!sessionOpen}
            />
          </Field>
        </Section>

        <Section title="Medical">
          <Field label="Blood type">
            <Select
              value={form.bloodType}
              onChange={(v) => setForm({ ...form, bloodType: v as BloodType })}
              options={BLOOD_TYPES.map((b) => ({ value: b, label: b.replace("_", " ") }))}
              disabled={!sessionOpen}
            />
          </Field>
          <Field label="Allergies" full>
            <Textarea value={form.allergies} onChange={(v) => setForm({ ...form, allergies: v })} disabled={!sessionOpen} />
          </Field>
          <Field label="Chronic conditions" full>
            <Textarea
              value={form.chronicConditions}
              onChange={(v) => setForm({ ...form, chronicConditions: v })}
              disabled={!sessionOpen}
            />
          </Field>
          <Field label="Current medications" full>
            <Textarea
              value={form.currentMedications}
              onChange={(v) => setForm({ ...form, currentMedications: v })}
              disabled={!sessionOpen}
            />
          </Field>
        </Section>

        {sessionOpen && (
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setForm(baseline)}
              disabled={!dirty || saving}
            >
              Reset
            </Button>
            <Button type="submit" loading={saving} disabled={!dirty}>
              Save profile
            </Button>
          </div>
        )}
      </form>

      {/* Doctor note */}
      <section className="rounded-lg border border-border bg-surface-raised p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-medium text-text-primary">Clinical note</h2>
          {sessionOpen ? (
            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
              Editable
            </span>
          ) : (
            <span className="font-mono text-2xs uppercase tracking-widest text-text-subtle">Read-only</span>
          )}
        </div>
        {data.notes && (
          <div className="rounded-md border border-border bg-surface-base p-3 text-sm italic text-text-body">
            <span className="block font-mono text-[10px] not-italic uppercase tracking-widest text-text-subtle">Patient note</span>
            "{data.notes}"
          </div>
        )}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX_LENGTH))}
          rows={6}
          disabled={!sessionOpen || noteSaving}
          placeholder="Document the visit (visible to the patient and other staff)…"
          className="w-full resize-y rounded-md border border-border bg-surface-base p-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-neutral-50 disabled:text-text-muted"
        />
        {sessionOpen && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-muted">{note.length}/{NOTE_MAX_LENGTH}</span>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveNote}
              loading={noteSaving}
              disabled={(note ?? "").trim() === (data.doctorNote ?? "").trim()}
            >
              Save note
            </Button>
          </div>
        )}
      </section>

      {/* Footer actions */}
      {data.status === "BOOKED" && data.startedAt && !data.endedAt && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={handleEnd}
            loading={ending}
            className="text-danger-fg hover:bg-danger-bg hover:border-danger-border transition-colors"
          >
            End appointment
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------- small UI helpers ----------

function SessionBadge({ data, sessionOpen }: { data: SessionPayload; sessionOpen: boolean }) {
  if (data.status === "CANCELLED") {
    return <Pill tone="neutral">Cancelled</Pill>;
  }
  if (data.status === "COMPLETED") {
    return <Pill tone="green">Completed</Pill>;
  }
  if (sessionOpen) {
    return <Pill tone="amber">In session</Pill>;
  }
  if (data.startedAt) {
    return <Pill tone="neutral">Window closed</Pill>;
  }
  return <Pill tone="blue">Not started</Pill>;
}

function Pill({ tone, children }: { tone: "blue" | "green" | "amber" | "neutral"; children: React.ReactNode }) {
  const map = {
    blue: "bg-blue-50 text-blue-700 ring-blue-700/10",
    green: "bg-green-50 text-green-700 ring-green-600/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-700/10",
    neutral: "bg-neutral-100 text-neutral-600 ring-neutral-500/10",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${map[tone]}`}>
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface-raised p-5">
      <h2 className="mb-4 font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1.5 text-xs ${full ? "sm:col-span-2" : ""}`}>
      <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">{label}</span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  disabled,
  type,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <input
      type={type ?? "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-9 rounded-md border border-border bg-surface-base px-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-neutral-50 disabled:text-text-muted"
    />
  );
}

function Textarea({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={3}
      className="resize-y rounded-md border border-border bg-surface-base p-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-neutral-50 disabled:text-text-muted"
    />
  );
}

function Select({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-9 rounded-md border border-border bg-surface-base px-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-neutral-50 disabled:text-text-muted"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function ReadField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">{label}</span>
      <span className={`text-sm text-text-primary ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
