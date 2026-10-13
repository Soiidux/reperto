import AppointmentCard from "@/components/AppointmentCard";
import { getActiveAppointments, getTodaysAppointments } from "@/api/appointment";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface Appointment {
  _id: string;
  patientId: {
    _id: string;
    name: string;
    gender: string;
    dateOfBirth: string;
    profileImageUrl?: string;
  } | string; // Polished to adapt if patientId is populated or raw ID string
  doctorId: {
    _id: string;
    name: string;
    profileImageUrl?: string;
  } | string; // Polished to adapt if doctorId is populated or raw ID string
  appointmentDate: string;
  timeSlot: string;
  durationInMinutes: number;
  status: "pending" | "arrived" | "completed" | "cancelled" | "no-show";
  consultationType: 'Initial' | 'Follow-up' | 'Acute';
  needsReschedule?: boolean;
  rescheduleSuggestions?: { date: string; timeSlot: string }[];
}

export default function Appointments() {
  const [count, setCount] = useState(0);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  // Doctors only plan today's scheduled visits here; arrived patients move
  // to the Waiting Queue. Patients/staff still see every upcoming booking.
  const isDoctor = user?.role === "doctor";

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (isDoctor) {
          const response = await getTodaysAppointments();
          const todaysScheduled =
            (response.data.data.appointments as Appointment[])?.filter(
              (appointment) => appointment.status === "pending",
            ) ?? [];
          if (!active) return;
          setAppointments(todaysScheduled);
          setCount(todaysScheduled.length);
        } else {
          const response = await getActiveAppointments();
          if (!active) return;
          setAppointments(response.data.data.appointments ?? []);
          setCount(response.data.data.count ?? 0);
        }
      } catch (err: unknown) {
        if (active) toast.error(getErrorMessage(err, "Failed to load appointments"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isDoctor]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <span className="text-sm text-gray-500">
          {loading
            ? "Loading…"
            : `${count} ${isDoctor ? "Scheduled Today" : "Upcoming Appointments"}`}
        </span>
        <Link
          to={`/${user?.role}/appointments/all`}
          className="text-sm text-gray-500 hover:text-gray-800 hover:underline"
        >
          View All
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          // Without this the empty state flashed "No appointments found."
          // on every visit before the response landed.
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))
        ) : appointments.length > 0 ? (
          appointments.map((appointment) => (
            <AppointmentCard key={appointment._id} {...appointment} />
          ))
        ) : (
          <p className="col-span-full py-8 text-center text-neutral-400">
            {isDoctor ? "No appointments scheduled for today." : "No appointments found."}
          </p>
        )}
      </div>
    </div>
  );
}
