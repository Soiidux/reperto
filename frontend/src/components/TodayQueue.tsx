import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, CheckCheck, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "@/components/StatCard";
import TicketScanner from "@/components/TicketScanner";
import { AppointmentStatusControl } from "@/components/AppointmentStatusControl";
import type { AppointmentStatus } from "@/lib/appointmentStatus";
import { getTodaysAppointments, updateAppointmentStatus } from "@/api/appointment";
import { getErrorMessage } from "@/lib/utils";

export interface TodayAppointment {
  _id: string;
  patientId: { _id: string; name: string; profileImageUrl?: string };
  doctorId: { _id: string; name: string };
  appointmentDate: string;
  timeSlot: string;
  consultationType: "Initial" | "Follow-up" | "Acute";
  status: string;
  checkedInAt?: string | null;
  checkedInBy?: { _id: string; name: string } | null;
}

/** "Checked in 09:42 by Jane Doe" — shown on waiting-room rows. */
const formatCheckedIn = (appt: TodayAppointment): string | null => {
  if (!appt.checkedInAt) return null;
  const time = new Date(appt.checkedInAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const by = appt.checkedInBy?.name;
  return by ? `Checked in ${time} by ${by}` : `Checked in ${time}`;
};

interface TodayQueueProps {
  /** Optional section heading (e.g. on dashboards that group it). */
  heading?: string;
}

/**
 * Today's reception queue: ticket scanner + "Scheduled Today" / "Waiting Room"
 * lists. Shared by the staff and admin dashboards — both roles are allowed to
 * check patients in and move bookings through any status.
 */
export function TodayQueue({ heading }: TodayQueueProps) {
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

  // Front desk may move a booking to any status (reopen included).
  const changeStatus = async (
    id: string,
    status: AppointmentStatus,
    cancellationReason?: string,
  ) => {
    setUpdatingId(id);
    try {
      await updateAppointmentStatus(id, { status, cancellationReason });
      toast.success(`Status changed to ${status}`);
      await loadToday();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update status"));
    } finally {
      setUpdatingId(null);
    }
  };

  const arrived = appointments.filter((a) => a.status === "arrived");
  const scheduled = appointments.filter((a) => a.status === "pending");

  return (
    <div className="flex flex-col gap-6">
      {heading ? (
        <h2 className="text-lg font-semibold text-neutral-900">{heading}</h2>
      ) : null}

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

      {/* Reception check-in: scan or type the ticket QR. Refreshes the queue
          below so scanned patients drop out of "Scheduled Today". */}
      <TicketScanner
        onCheckedIn={() => {
          void loadToday();
        }}
      />

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
                  <AppointmentStatusControl
                    status={appt.status}
                    disabled={updatingId === appt._id}
                    onChange={(status, cancellationReason) =>
                      changeStatus(appt._id, status, cancellationReason)
                    }
                  />
                  <Button size="sm" onClick={() => markArrived(appt._id)} disabled={updatingId === appt._id}>
                    {updatingId === appt._id ? "..." : "Mark Arrived"}
                  </Button>
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
              {arrived.map((appt) => {
                const checkedIn = formatCheckedIn(appt);
                return (
                  <li key={appt._id} className="flex items-center gap-4 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                      {appt.patientId?.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-neutral-900">{appt.patientId?.name || "Unknown"}</p>
                      <p className="text-sm text-neutral-500">
                        {appt.timeSlot} · {appt.consultationType} · {appt.doctorId?.name}
                      </p>
                      {checkedIn ? (
                        <p className="text-xs text-neutral-400">{checkedIn}</p>
                      ) : null}
                    </div>
                    <AppointmentStatusControl
                      status={appt.status}
                      disabled={updatingId === appt._id}
                      onChange={(status, cancellationReason) =>
                        changeStatus(appt._id, status, cancellationReason)
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}