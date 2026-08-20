import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, CalendarPlus, ClipboardCheck, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "@/components/StatCard";
import AppointmentCard from "@/components/AppointmentCard";
import ConsultationCard from "@/components/ConsultationCard";
import { useAuthStore } from "@/store/authStore";
import { getActiveAppointments } from "@/api/appointment";
import { getPatientHistory } from "@/api/consultation";
import { getErrorMessage } from "@/lib/utils";

interface PatientRef {
  _id: string;
  name: string;
  gender: string;
  dateOfBirth: string;
  profileImageUrl?: string;
}

interface DoctorRef {
  _id: string;
  name: string;
  profileImageUrl?: string;
}

interface ActiveAppointment {
  _id: string;
  patientId: PatientRef | string;
  doctorId: DoctorRef | string;
  appointmentDate: string;
  timeSlot: string;
  durationInMinutes: number;
  status: "pending" | "arrived" | "completed" | "cancelled" | "no-show";
  consultationType: "Initial" | "Follow-up" | "Acute";
}

interface HistoryItem {
  _id: string;
  appointmentId: { _id: string; appointmentDate: string; consultationType: "Initial" | "Follow-up" | "Acute" };
  patientId: PatientRef;
  doctorId: DoctorRef;
  chiefComplaintDetails: { location: string; sensation: string };
  diagnosis: string;
  prescriptions: { remedyName: string; potency: string | null; dosage: string; durationInDays: number }[];
}

export default function PatientDashboard() {
  const { user } = useAuthStore();
  const [upcoming, setUpcoming] = useState<ActiveAppointment[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [apptRes, histRes] = await Promise.all([
          getActiveAppointments(),
          user?.id ? getPatientHistory(user.id) : Promise.reject(new Error("no user")),
        ]);
        setUpcoming(apptRes.data.data.appointments ?? []);
        if (histRes?.data?.success) {
          setHistory(histRes.data.data.history ?? []);
        }
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, "Failed to load your dashboard"));
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Welcome back, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-neutral-500">Here is an overview of your care.</p>
        </div>
        <Link to="/patient/book-appointment">
          <Button><CalendarPlus className="size-4" /> Book Appointment</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loading ? (
          <>
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </>
        ) : (
          <>
            <StatCard title="Upcoming Appointments" value={upcoming.length} icon={CalendarDays} />
            <StatCard title="Completed Consultations" value={history.length} icon={ClipboardCheck} />
            <StatCard title="Your Doctors" value={new Set(history.map((h) => h.doctorId?._id)).size} icon={Stethoscope} />
          </>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">Upcoming Appointments</h2>
        {loading ? (
          <div className="flex flex-wrap gap-4">
            <Skeleton className="h-44 w-96 rounded-xl" />
            <Skeleton className="h-44 w-96 rounded-xl" />
          </div>
        ) : upcoming.length === 0 ? (
          <p className="py-6 text-center text-neutral-400">No upcoming appointments. Book one to get started.</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {upcoming.map((appt) => (
              <AppointmentCard key={appt._id} {...appt} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">Recent Consultations</h2>
        {loading ? (
          <div className="flex flex-wrap gap-4">
            <Skeleton className="h-44 w-96 rounded-xl" />
          </div>
        ) : history.length === 0 ? (
          <p className="py-6 text-center text-neutral-400">No consultations yet.</p>
        ) : (
          <div className="flex flex-wrap gap-4">
{history.slice(0, 4).map((item) => (
              <ConsultationCard key={item._id} {...item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}