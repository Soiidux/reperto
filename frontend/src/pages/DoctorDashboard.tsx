import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, CheckCheck, ClipboardList, Stethoscope, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "@/components/StatCard";
import { useAuthStore } from "@/store/authStore";
import { getTodaysAppointments, getActiveAppointments } from "@/api/appointment";
import { getErrorMessage } from "@/lib/utils";

interface TodayAppointment {
  _id: string;
  patientId: { _id: string; name: string; profileImageUrl?: string; gender?: string };
  doctorId: { _id: string; name: string };
  appointmentDate: string;
  timeSlot: string;
  consultationType: "Initial" | "Follow-up" | "Acute";
  status: string;
}

export default function DoctorDashboard() {
  const { user } = useAuthStore();
  const [today, setToday] = useState<TodayAppointment[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [todayRes, activeRes] = await Promise.all([
          getTodaysAppointments(),
          getActiveAppointments(),
        ]);
        setToday(todayRes.data.data.appointments ?? []);
        setActiveCount(activeRes.data.data.appointments.length ?? 0);
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, "Failed to load your schedule"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const arrivedCount = today.filter((a) => a.status === "arrived").length;
  const notArrivedCount = today.filter((a) => a.status === "pending" || a.status === "confirmed").length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Doctor Slate</h1>
        <p className="text-sm text-neutral-500">Good day, {user?.name?.split(" ")[0]}. Here's today's plan.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </>
        ) : (
          <>
            <StatCard title="Today's Appointments" value={today.length} icon={CalendarDays} />
            <StatCard title="Not Yet Arrived" value={notArrivedCount} icon={Clock} />
            <StatCard title="In Waiting Room" value={arrivedCount} icon={CheckCheck} />
            <StatCard title="Active (All)" value={activeCount} icon={ClipboardList} />
          </>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">Today's Schedule</h2>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        ) : today.length === 0 ? (
          <p className="py-6 text-center text-neutral-400">No appointments scheduled for today.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-400">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {today.map((appt) => (
                  <tr key={appt._id} className="border-t border-neutral-100">
                    <td className="px-4 py-3 font-medium text-neutral-900">{appt.timeSlot}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {appt.patientId?.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <span className="font-medium text-neutral-800">{appt.patientId?.name || "Unknown"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{appt.consultationType}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="capitalize">{appt.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {appt.status === "arrived" ? (
                        <Button size="sm" asChild className="px-3">
                          <Link to={`/doctor/start-consultation/${appt._id}`}>
                            <Stethoscope className="size-4" /> Start Consultation
                          </Link>
                        </Button>
                      ) : appt.status === "completed" ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/doctor/appointments/${appt._id}`}>View</Link>
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}