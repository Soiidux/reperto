import AppointmentCard from "@/components/AppointmentCard";
import { getActiveAppointments, getTodaysAppointments } from "@/api/appointment";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";

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
  const { user } = useAuthStore();
  // Doctors only plan today's scheduled visits here; arrived patients move
  // to the Waiting Queue. Patients/staff still see every upcoming booking.
  const isDoctor = user?.role === "doctor";

  useEffect(() => {
    (async () => {
      try {
        if (isDoctor) {
          const response = await getTodaysAppointments();
          const todaysScheduled =
            (response.data.data.appointments as Appointment[])?.filter(
              (appointment) => appointment.status === "pending",
            ) ?? [];
          setAppointments(todaysScheduled);
          setCount(todaysScheduled.length);
        } else {
          const response = await getActiveAppointments();
          setAppointments(response.data.data.appointments);
          setCount(response.data.data.count);
        }
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, "Failed to load appointments"));
      }
    })();
  }, [isDoctor]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">
          {isDoctor ? `${count} Scheduled Today` : `${count} Upcoming Appointments`}
        </span>
        <span className="text-sm text-gray-500 hover:text-gray-800 hover:underline hover:cursor-pointer"><Link to={`/${user?.role}/appointments/all`}>View All</Link></span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {count !== 0 ? appointments?.map((appointment) => (
          <AppointmentCard
            key={appointment._id}
            {...appointment}
          />
        )) : <p>{isDoctor ? "No appointments scheduled for today." : "No appointments found."}</p>}
      </div>
    </div>
  );
}
