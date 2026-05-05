/**
 * Doctor name display helpers.
 *
 * The DB stores the doctor's bare name (e.g. "Ayşe Yılmaz") and the title
 * lives separately on the Doctor row. We never want to render a stray "Dr. Dr."
 * so any incoming name is normalised before the title is prefixed.
 */

export const DOCTOR_TITLES = [
  "Dr.",
  "Specialist Dr.",
  "Assoc. Prof. Dr.",
  "Prof. Dr.",
] as const;

export type DoctorTitle = (typeof DOCTOR_TITLES)[number];

/**
 * Strip any leading title token from a name. Covers the current English
 * titles plus legacy Turkish forms ("Op. Dr.", "Uzm. Dr.", "Doç. Dr.")
 * that may still live in older seed/test data.
 */
export function stripDoctorTitle(name: string): string {
  return name
    .replace(
      /^(prof\.?\s*dr\.?|assoc\.?\s*prof\.?\s*dr\.?|specialist\s*dr\.?|do[çc]\.?\s*dr\.?|uzm\.?\s*dr\.?|op\.?\s*dr\.?|dr\.?)\s+/i,
      "",
    )
    .trim();
}

/** Build a display name: "<title> <bare name>", defaulting to "Dr." if missing. */
export function doctorDisplayName(
  name: string,
  title?: string | null,
): string {
  const bare = stripDoctorTitle(name);
  const t = (title ?? "Dr.").trim();
  return `${t} ${bare}`.trim();
}

/** Two-letter initials from the bare name (title stripped). */
export function doctorInitials(name: string): string {
  const cleaned = stripDoctorTitle(name);
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]![0] : "";
  return (first + last).toUpperCase();
}
