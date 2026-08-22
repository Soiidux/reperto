import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, CheckCheck, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "@/components/StatCard";
import { getTodaysAppointments, updateAppointmentStatus } from "@/api/appointment";
import { getErrorMessage } from "@/lib/utils";

interface TodayAppointment {
  _id: string;
  patientId: { _id: string; name: string; profileImageUrl?: string };
  doctorId: { _id: string; name: string };
  appointmentDate: string;
  timeSlot: string;
  consultationType: "Initial" | "Follow-up" | "Acute";
  status: string;
}

export default function StaffDashboard() {
  const [appointments, setAppointments] = useState<TodayAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const applyToday = (response: { data: { data: { appointments?: TodayAppointment[] } } }) => {
    setAppointments(response.data.data.appointments ?? []);
  };

  const loadToday = async () => {
    setLoading(true);
    try {
      const response = await getTodaysAppointments();
      applyToday(response);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to load today's schedule"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const response = await getTodaysAppointments();
        applyToday(response);
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, "Failed to load today's schedule"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const markArrived = async (id: string) => {
    setUpdatingId(id);
    try {
      await updateAppointmentStatus(id, { status: "arrived", cancellationReason: undefined });
      toast.success("Patient marked as arrived");
      await loadToday();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update status"));
    } finally {
      setUpdatingId(null);
    }
  };

  const arrived = appointments.filter((a) => a.status === "arrived");
  const scheduled = appointments.filter((a) => a.status === "pending" || a.status === "confirmed");

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Staff Dashboard</h1>
        <p className="text-sm text-neutral-500">Welcome to the front desk. Manage today's queue.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {loading ? (
          <>
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </>
        ) : (
          <>
            <StatCard title="Today's Appointments" value={appointments.length} icon={CalendarDays} />
            <StatCard title="Not Yet Arrived" value={scheduled.length} icon={Clock} />
            <StatCard title="In Waiting Room" value={arrived.length} icon={CheckCheck} />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scheduled Today</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : scheduled.length === 0 ? (
            <p className="py-8 text-center text-neutral-400">No pending appointments for today.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {scheduled.map((appt) => (
                <li key={appt._id} className="flex items-center gap-4 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                    {appt.patientId?.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900">{appt.patientId?.name || "Unknown"}</p>
                    <p className="text-sm text-neutral-500">
                      {appt.timeSlot} · {appt.consultationType} · {appt.doctorId?.name}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">{appt.status}</Badge>
                  {appt.status === "pending" || appt.status === "confirmed" ? (
                    <Button size="sm" onClick={() => markArrived(appt._id)} disabled={updatingId === appt._id}>
                      {updatingId === appt._id ? "..." : "Mark Arrived"}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Waiting Room</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : arrived.length === 0 ? (
            <p className="py-8 text-center text-neutral-400">Nobody is waiting right now.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {arrived.map((appt) => (
                <li key={appt._id} className="flex items-center gap-4 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                    {appt.patientId?.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900">{appt.patientId?.name || "Unknown"}</p>
                    <p className="text-sm text-neutral-500">
                      {appt.timeSlot} · {appt.consultationType} · {appt.doctorId?.name}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">{appt.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}