"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import type { Doctor } from "@/lib/types";
import { doctorDisplayName } from "@/lib/doctor-name";

interface TimeSlot {
  id: string;
  doctorId: string;
  date: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
}

export default function DoctorProfilePage() {
  const params = useParams();
  const router = useRouter();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Booking Modal States ---
  const [bookingSlot, setBookingSlot] = useState<TimeSlot | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const fetchDoctorAndSlots = async () => {
    try {
      const docRes = await apiGet<Doctor>(`/doctors/${params.id}`);
      setDoctor(docRes);

      try {
        const slotsRes = await apiGet<TimeSlot[] | { items: TimeSlot[] }>(
          `/slots?doctorId=${params.id}&isBooked=false`
        );
        const extractedSlots = Array.isArray(slotsRes) 
          ? slotsRes 
          : (slotsRes as { items: TimeSlot[] }).items || [];

        // KESİN ÇÖZÜM 1: Sadece "Şu anki zamandan" (Date.now) daha ileride olan saatleri state'e al.
        const nowMs = Date.now();
        const futureSlots = extractedSlots.filter(
          (slot) => new Date(slot.startTime).getTime() > nowMs
        );

        setSlots(futureSlots);
      } catch (slotErr) {
        console.error("Failed to fetch slots:", slotErr);
      }
    } catch (err: any) {
      setError(err.message || "Doctor profile not found.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      fetchDoctorAndSlots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  // KESİN ÇÖZÜM 2: Tarihleri Local Time (Yerel Saat) olarak grupla. (UTC kaymasını önler)
  const getLocalDateString = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const availableDates = useMemo(() => {
    const dates = Array.from(
      new Set(slots.map((slot) => getLocalDateString(slot.startTime)))
    );
    return dates.sort();
  }, [slots]);

  useEffect(() => {
    if (availableDates.length > 0 && (!selectedDate || !availableDates.includes(selectedDate))) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates, selectedDate]);

  const slotsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return slots.filter((slot) => getLocalDateString(slot.startTime) === selectedDate);
  }, [slots, selectedDate]);

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateTab = (dateString: string) => {
    // "YYYY-MM-DD" formatını güvenli çevirmek için ortaya T12:00:00 ekliyoruz
    return new Date(`${dateString}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const handleConfirmBooking = async () => {
    if (!bookingSlot || !doctor) return;

    // KESİN ÇÖZÜM 3: Tıklama anında da "Geçmiş zaman" güvenlik kontrolü
    if (new Date(bookingSlot.startTime).getTime() < Date.now()) {
      setBookingError("This slot has already passed. Please select a valid future slot.");
      return;
    }
    
    setIsSubmitting(true);
    setBookingError(null);

    try {
      await apiPost("/appointments", {
        doctorId: doctor.id,
        timeSlotId: bookingSlot.id,
        notes: notes.trim() || undefined,
      });
      setBookingSuccess(true);
    } catch (err: any) {
      if (err.status === 409) {
        setBookingError("This slot was just booked by someone else. Please select another one.");
      } else if (err.status >= 500) {
        setBookingError("Server error occurred. This slot might be invalid or no longer available.");
      } else {
        setBookingError(err.message || "Failed to book appointment. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setBookingSlot(null);
    setNotes("");
    setBookingError(null);
    if (bookingSuccess) {
      setBookingSuccess(false);
      fetchDoctorAndSlots();
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-[1.5px] border-text-muted border-t-transparent" />
      </div>
    );
  }

  if (error || !doctor) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-10 text-center text-red-600">
        <p className="font-medium">{error || "Something went wrong."}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      <header className="space-y-4">
        <button
          onClick={() => router.back()}
          className="font-mono text-xs uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
        >
          &larr; Back to Doctors
        </button>

        <div>
          <h1 className="font-display text-4xl font-normal text-text-primary">
            {doctorDisplayName(doctor.user.name, doctor.title)}
          </h1>
          <p className="mt-1 text-lg text-text-muted">{doctor.specialization}</p>
        </div>

        <p className="max-w-[60ch] text-md text-text-body leading-relaxed">
          {doctor.bio || "No biography provided for this doctor at the moment."}
        </p>
      </header>

      <section className="rounded-lg border border-border bg-surface-raised p-8 shadow-xs">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-medium text-text-primary">
            Available Times
          </h2>
        </div>

        {availableDates.length === 0 ? (
          <p className="text-sm text-text-muted">
            There are no available slots for this doctor at the moment. Please check back later.
          </p>
        ) : (
          <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {availableDates.map((dateStr) => (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`shrink-0 rounded-md border px-4 py-2 text-sm font-medium transition-colors focus:outline-none ${
                    selectedDate === dateStr
                      ? "border-primary-700 bg-primary-700 text-white"
                      : "border-border bg-surface-base text-text-primary hover:bg-neutral-50"
                  }`}
                >
                  {formatDateTab(dateStr)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {slotsForSelectedDate.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => setBookingSlot(slot)}
                  className="flex items-center justify-center rounded-md border border-border bg-surface-base py-3 transition-colors hover:border-primary-600 hover:bg-primary-50 focus:outline-none"
                >
                  <span className="text-sm font-semibold text-text-primary">
                    {formatTime(slot.startTime)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* --- Booking Modal --- */}
      {bookingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl border border-border">
            
            {bookingSuccess ? (
              <div className="flex flex-col items-center text-center space-y-4 py-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-display text-2xl text-text-primary">Appointment Confirmed!</h3>
                <p className="text-sm text-text-muted">
                  Your appointment with {doctorDisplayName(doctor.user.name, doctor.title)} has been successfully scheduled.
                </p>
                <div className="flex w-full flex-col gap-2 pt-4">
                  <Button onClick={() => router.push("/patient/appointments")} className="w-full">
                    View my appointments
                  </Button>
                  <Button variant="outline" onClick={handleCloseModal} className="w-full">
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="font-display text-xl font-medium text-text-primary mb-3">
                  Confirm Booking
                </h3>
                
                <div className="mb-6 rounded-lg bg-neutral-50 p-5 border border-border">
                  <p className="text-sm text-text-muted mb-2">Doctor: <span className="font-medium text-text-primary">{doctorDisplayName(doctor.user.name, doctor.title)}</span></p>
                  <p className="text-sm text-text-muted mb-2">Date: <span className="font-medium text-text-primary">{formatDateTab(getLocalDateString(bookingSlot.startTime))}</span></p>
                  <p className="text-sm text-text-muted">Time: <span className="font-medium text-text-primary">{formatTime(bookingSlot.startTime)}</span></p>
                </div>

                <div className="mb-6">
                  <label htmlFor="notes" className="block text-sm font-medium text-text-primary mb-2">
                    Notes for the doctor (Optional)
                  </label>
                  <textarea
                    id="notes"
                    rows={4}
                    maxLength={500}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Describe your symptoms or reason for visit..."
                    className="w-full resize-none rounded-md border border-border bg-white p-3 text-sm text-text-primary focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 shadow-sm"
                  />
                  <div className="flex justify-end mt-1">
                    <span className="text-xs text-text-muted">{notes.length}/500</span>
                  </div>
                </div>

                {bookingError && (
                  <div className="mb-4 rounded-md bg-red-50 p-3 border border-red-100">
                    <p className="text-sm text-red-600">{bookingError}</p>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={handleCloseModal} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button onClick={handleConfirmBooking} loading={isSubmitting}>
                    Confirm Appointment
                  </Button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}