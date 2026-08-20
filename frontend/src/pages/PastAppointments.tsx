import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllAppointments } from "@/api/appointment";
import { getErrorMessage } from "@/lib/utils";

interface PastAppointment {
  _id: string;
  patientId: { _id: string; name: string };
  appointmentDate: string;
  timeSlot: string;
  consultationType: string;
  status: string;
}

const statusVariant: Record<string, "default" | "outline" | "secondary" | "destructive"> = {
  completed: "default",
  ["no-show"]: "secondary",
  cancelled: "destructive",
};

export default function PastAppointments() {
  const [appointments, setAppointments] = useState<PastAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("completed");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const response = await getAllAppointments({ status: statusFilter, limit: 50 });
        setAppointments(response.data.data.appointments ?? []);
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, "Failed to load past appointments"));
      } finally {
        setLoading(false);
      }
    })();
  }, [statusFilter]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Past Appointments</h1>
        <p className="text-sm text-neutral-500">Completed, no-show, and cancelled appointments.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Records</CardTitle>
          <div className="flex gap-2">
            {["completed", "no-show", "cancelled"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                className="capitalize"
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : appointments.length === 0 ? (
            <p className="py-8 text-center text-neutral-400">No {statusFilter} appointments found.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {appointments.map((appt) => (
                <li key={appt._id} className="flex items-center gap-4 py-3">
                  <CalendarClock className="size-5 shrink-0 text-neutral-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900">{appt.patientId?.name || "Unknown"}</p>
                    <p className="text-sm text-neutral-500">
                      {new Date(appt.appointmentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} · {appt.timeSlot} · {appt.consultationType}
                    </p>
                  </div>
                  <Badge variant={statusVariant[appt.status] || "outline"} className="capitalize">{appt.status}</Badge>
                  <Link to={`/doctor/appointments/${appt._id}`}>
                    <Button variant="outline" size="sm">View</Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}