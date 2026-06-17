import AppointmentCard from "@/components/AppointmentCard";
import { getArrivedAppointments } from "@/api/appointment";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

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
}

export default function Appointments() {
  const [count, setCount] = useState(0);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  useEffect(() => {
    async function fetchAppointments() {
      const response = await getArrivedAppointments();
      setAppointments(response.data.data.appointments);
      setCount(response.data.data.count);
      console.log("appointments", appointments);
      console.log("count", count);
    }
    fetchAppointments();
  }, []);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">{count} Upcoming Appointments</span>
        <span className="text-sm text-gray-500 hover:text-gray-800 hover:underline hover:cursor-pointer"><Link to={`/doctor/appointments/all`}>View All</Link></span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {count !== 0 ? appointments?.map((appointment) => (
          <AppointmentCard 
            key={appointment._id} 
            {...appointment} 
          />
        )) : <p>No appointments found.</p>}
      </div>
    </div>
  );
}