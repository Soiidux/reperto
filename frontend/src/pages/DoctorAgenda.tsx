import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getAllAppointments } from "@/api/appointment";
import { getErrorMessage } from "@/lib/utils";

interface AgendaAppointment {
  _id: string;
  patientId: { _id: string; name: string; profileImageUrl?: string; gender?: string };
  doctorId: { _id: string; name: string };
  appointmentDate: string;
  timeSlot: string;
  consultationType: "Initial" | "Follow-up" | "Acute";
  status: string;
}

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const timeToMinutes = (slot: string) => {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(slot);
  if (!match) return 0;
  const [, hStr, mStr, meridiem] = match;
  let h = Number(hStr) % 12;
  if (meridiem.toUpperCase() === "PM") h += 12;
  return h * 60 + Number(mStr);
};

const statusVariant = (status: string) => {
  switch (status) {
    case "arrived":
      return "default";
    case "completed":
      return "secondary";
    case "cancelled":
    case "no-show":
      return "destructive";
    default:
      return "outline";
  }
};

export default function DoctorAgenda() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [appointments, setAppointments] = useState<AgendaAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  const dateKey = toDateKey(selectedDate);

  const loadDate = async (date: Date) => {
    setLoading(true);
    const key = toDateKey(date);
    try {
      const res = await getAllAppointments({ from: key, to: key });
      setAppointments(res.data.data.appointments ?? []);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to load the agenda"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  const sorted = useMemo(
    () => [...appointments].sort((a, b) => timeToMinutes(a.timeSlot) - timeToMinutes(b.timeSlot)),
    [appointments],
  );

  const todayKey = toDateKey(new Date());
  const isToday = dateKey === todayKey;

  const shiftDay = (delta: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + delta);
    setSelectedDate(next);
  };

  const statusCounts = appointments.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Agenda</h1>
        <p className="text-sm text-neutral-500">Your day at a glance. Pick a date to see the full schedule.</p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Day picker */}
        <div className="z-50 shrink-0 lg:w-72">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarDays className="mr-2 size-4" />
                {selectedDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
              />
            </PopoverContent>
          </Popover>

          <div className="mt-3 flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shiftDay(-1)} aria-label="Previous day">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => {
              const now = new Date();
              setSelectedDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
            }}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => shiftDay(1)} aria-label="Next day">
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {!loading && appointments.length > 0 && (
            <div className="mt-4 space-y-1 rounded-xl border border-neutral-200 p-3 text-sm">
              <p className="mb-2 flex items-center gap-1.5 font-medium text-neutral-700">
                <Stethoscope className="size-4 text-primary" /> {appointments.length} appointment{appointments.length === 1 ? "" : "s"}
              </p>
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-neutral-500">
                  <Badge variant={statusVariant(status)} className="capitalize">{status}</Badge>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="flex-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">
              {selectedDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </h2>
            {isToday && <Badge variant="secondary">Today</Badge>}
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ) : sorted.length === 0 ? (
            <p className="py-10 text-center text-neutral-400">No appointments on this day.</p>
          ) : (
            <div className="space-y-2">
              {sorted.map((appt) => (
                <Link
                  key={appt._id}
                  to={`/doctor/appointments/${appt._id}`}
                  className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-primary/40 hover:bg-neutral-50"
                >
                  <div className="w-20 shrink-0 text-sm font-semibold text-neutral-900">{appt.timeSlot}</div>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {appt.patientId?.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-800">{appt.patientId?.name || "Unknown"}</p>
                      <p className="truncate text-xs text-neutral-400">{appt.consultationType}</p>
                    </div>
                  </div>
                  <Badge variant={statusVariant(appt.status)} className="capitalize">{appt.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}