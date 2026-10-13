import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, CheckCheck, ClipboardList, Stethoscope, Clock, CircleCheck, CircleDashed, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "@/components/StatCard";
import { useAuthStore } from "@/store/authStore";
import { getTodaysAppointments, getActiveAppointments } from "@/api/appointment";
import { getFollowUps, markFollowUp } from "@/api/consultation";
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

interface FollowUp {
  _id: string;
  patientId: { _id: string; name: string; profileImageUrl?: string; gender?: string };
  diagnosis?: string;
  followUpDate: string;
  followUpStatus: "pending" | "overdue" | "done" | "skipped";
  appointmentId?: string;
}

export default function DoctorDashboard() {
  const { user } = useAuthStore();
  const [today, setToday] = useState<TodayAppointment[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [todayRes, activeRes, followUpsRes] = await Promise.all([
          getTodaysAppointments(),
          getActiveAppointments(),
          getFollowUps(),
        ]);
        setToday(todayRes.data.data.appointments ?? []);
        setActiveCount(activeRes.data.data.appointments.length ?? 0);
        setFollowUps(followUpsRes.data.data ?? []);
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, "Failed to load your schedule"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const arrivedCount = today.filter((a) => a.status === "arrived").length;
  const notArrivedCount = today.filter((a) => a.status === "pending").length;

  const resolveFollowUp = async (id: string, status: "done" | "skipped") => {
    setSubmitting(id);
    try {
      await markFollowUp(id, status);
      setFollowUps((prev) => prev.map((f) => (f._id === id ? { ...f, followUpStatus: status as FollowUp["followUpStatus"] } : f)));
      toast.success(status === "done" ? "Follow-up marked as completed" : "Follow-up skipped");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update follow-up"));
    } finally {
      setSubmitting(null);
    }
  };

  const formatFollowUpDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const pendingFollowUps = followUps.filter((f) => f.followUpStatus !== "done");

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
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

      <section>
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">Follow-ups Due</h2>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        ) : pendingFollowUps.length === 0 ? (
          <p className="py-6 text-center text-neutral-400">No follow-ups due right now.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-400">
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Diagnosis</th>
                  <th className="px-4 py-3 font-medium">Due Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingFollowUps.map((f) => (
                  <tr key={f._id} className="border-t border-neutral-100">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {f.patientId?.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <span className="font-medium text-neutral-800">{f.patientId?.name || "Unknown"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{f.diagnosis || "-"}</td>
                    <td className="px-4 py-3 font-medium text-neutral-900">{formatFollowUpDate(f.followUpDate)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={f.followUpStatus === "overdue" ? "destructive" : "outline"} className="capitalize">
                        {f.followUpStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="outline" asChild className="px-3">
                          <Link to={`/doctor/consultation/${f.appointmentId || f._id}`}>Review</Link>
                        </Button>
                        <Button size="sm" variant="outline" className="px-3" disabled={submitting === f._id} onClick={() => resolveFollowUp(f._id, "done")}>
                          {submitting === f._id ? <CircleDashed className="size-4 animate-spin" /> : <CircleCheck className="size-4" />}
                          Done
                        </Button>
                        {f.followUpStatus === "pending" && (
                          <Button size="sm" variant="ghost" className="px-3 text-neutral-500" disabled={submitting === f._id} onClick={() => resolveFollowUp(f._id, "skipped")}>
                            <Ban className="size-4" /> Skip
                          </Button>
                        )}
                      </div>
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