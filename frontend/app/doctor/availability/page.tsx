"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

interface TimeSlot {
  id: string;
  doctorId: string;
  date: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
}

export default function AvailabilityManagementPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Modal & Form States ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ date: "", startTime: "", endTime: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSlots = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<TimeSlot[] | { items: TimeSlot[] }>("/slots");
      const extractedSlots = Array.isArray(res) ? res : (res as { items: TimeSlot[] }).items || [];
      
      // KESİN ÇÖZÜM: Sadece bitiş saati şu andan ileride olanları (Geçmişte kalmayanları) göster
      const nowMs = Date.now();
      const futureSlots = extractedSlots.filter(
        (slot) => new Date(slot.endTime).getTime() > nowMs
      );

      // Kronolojik sırala
      const sorted = futureSlots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      setSlots(sorted);
    } catch (err: any) {
      setError(err.message || "Failed to load availability slots.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, []);

  const groupedSlots = useMemo(() => {
    const groups: Record<string, TimeSlot[]> = {};
    slots.forEach((slot) => {
      // Yerel saate göre gruplama (Timezone kaymasını engeller)
      const d = new Date(slot.startTime);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(slot);
    });
    return groups;
  }, [slots]);

  const handleOpenModal = () => {
    const today = new Date().toISOString().split("T")[0];
    setFormData({ date: today, startTime: "09:00", endTime: "09:30" });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormError(null);
  };

  const handleCreateSlot = async () => {
    setFormError(null);
    
    if (!formData.date || !formData.startTime || !formData.endTime) {
      setFormError("All fields are required.");
      return;
    }

    const startDateTime = new Date(`${formData.date}T${formData.startTime}:00`);
    const endDateTime = new Date(`${formData.date}T${formData.endTime}:00`);
    const now = new Date();

    if (startDateTime < now) {
      setFormError("Cannot create availability slots in the past.");
      return;
    }

    const durationMs = endDateTime.getTime() - startDateTime.getTime();
    const durationMins = durationMs / (1000 * 60);

    if (durationMins < 15) {
      setFormError("Slot duration must be at least 15 minutes.");
      return;
    }
    if (durationMins > 240) {
      setFormError("Slot duration cannot exceed 4 hours.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost("/slots", {
        date: startDateTime.toISOString(),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
      });
      
      setIsModalOpen(false);
      fetchSlots(); 
    } catch (err: any) {
      setFormError("This time slot overlaps with an existing one, or there was a server error. Please adjust the times.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSlot = async (id: string, isBooked: boolean) => {
    if (isBooked) {
      alert("Cannot delete a booked slot. Cancel the appointment first.");
      return;
    }

    if (!window.confirm("Are you sure you want to remove this availability block?")) return;

    setDeletingId(id);
    try {
      await apiDelete(`/slots/${id}`);
      fetchSlots();
    } catch (err: any) {
      alert(err.message || "Failed to delete slot.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDateHeader = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric"
    });
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit"
    });
  };

  return (
    <div className="space-y-8 relative">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <button
            onClick={() => router.push("/doctor")}
            className="font-mono text-xs uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
          >
            &larr; Back to Dashboard
          </button>
          <h1 className="font-display text-4xl font-normal text-text-primary" style={{ letterSpacing: "-0.02em" }}>
            Availability Management
          </h1>
          <p className="max-w-[60ch] text-sm text-text-muted">
            Manage your working hours. Add new open slots or remove available ones.
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button onClick={handleOpenModal}>
            + Add New Slot
          </Button>
        </div>
      </header>

      <div className="rounded-lg border border-border bg-surface-raised shadow-xs p-6">
        {loading ? (
           <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading slots">
             {Array.from({ length: 8 }).map((_, i) => (
               <div key={i} className="animate-pulse rounded-md border border-border bg-surface-base p-4 space-y-2">
                 <Skeleton className="h-5 w-3/4" />
                 <Skeleton className="h-4 w-1/2" />
                 <Skeleton className="h-8 w-full mt-3" />
               </div>
             ))}
           </div>
        ) : error ? (
           <div role="alert" className="rounded-md border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg flex items-center justify-between">
             <span>{error}</span>
             <Button variant="outline" size="sm" onClick={fetchSlots}>Retry</Button>
           </div>
        ) : slots.length === 0 ? (
           <EmptyState
             icon={
               <svg className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
               </svg>
             }
             heading="No availability set"
             body="You haven't opened any time slots for the future yet. Add availability so patients can book appointments."
             action={{ label: "Add Availability", onClick: handleOpenModal }}
           />
        ) : (
           <div className="space-y-8">
             {Object.keys(groupedSlots).map((dateKey) => (
               <div key={dateKey} className="space-y-3">
                 <h3 className="font-display text-lg font-medium text-text-primary border-b border-border pb-2">
                   {formatDateHeader(groupedSlots[dateKey][0].startTime)}
                 </h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                   {groupedSlots[dateKey].map((slot) => (
                     <div 
                        key={slot.id} 
                        className={`flex flex-col rounded-md border p-4 transition-all ${
                          slot.isBooked 
                            ? "border-blue-200 bg-blue-50/50" 
                            : "border-border bg-surface-base hover:border-primary-300 hover:shadow-sm"
                        }`}
                     >
                       <div className="flex items-center justify-between mb-3">
                         <span className="text-sm font-semibold text-text-primary">
                           {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                         </span>
                         {slot.isBooked ? (
                           <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-2xs font-medium text-blue-700">
                             Booked
                           </span>
                         ) : (
                           <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-2xs font-medium text-green-700">
                             Available
                           </span>
                         )}
                       </div>
                       
                       <Button 
                         variant="outline" 
                         size="sm"
                         disabled={slot.isBooked}
                         loading={deletingId === slot.id}
                         onClick={() => handleDeleteSlot(slot.id, slot.isBooked)}
                         className={`w-full ${!slot.isBooked ? "text-danger-fg hover:bg-danger-bg hover:border-danger-border" : ""}`}
                       >
                         {slot.isBooked ? "Cannot Delete" : "Delete Slot"}
                       </Button>
                     </div>
                   ))}
                 </div>
               </div>
             ))}
           </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl border border-border">
            <h3 className="font-display text-xl font-medium text-text-primary mb-4">
              Add New Slot
            </h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="avail-date" className="block text-sm font-medium text-text-primary mb-1">Date</label>
                <input
                  id="avail-date"
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full rounded-md border border-border p-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="avail-start" className="block text-sm font-medium text-text-primary mb-1">Start Time</label>
                  <input
                    id="avail-start"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                    className="w-full rounded-md border border-border p-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                  />
                </div>
                <div>
                  <label htmlFor="avail-end" className="block text-sm font-medium text-text-primary mb-1">End Time</label>
                  <input
                    id="avail-end"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                    className="w-full rounded-md border border-border p-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                  />
                </div>
              </div>
              <p className="text-xs text-text-muted mt-1">
                Duration must be between 15 minutes and 4 hours.
              </p>
            </div>

            {formError && (
              <div className="mb-4 rounded-md bg-red-50 p-3 border border-red-100">
                <p className="text-sm text-red-600">{formError}</p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleCloseModal} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleCreateSlot} loading={isSubmitting}>
                Save Slot
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}