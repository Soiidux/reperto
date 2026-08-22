import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Armchair, RefreshCw, Stethoscope } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getArrivedAppointments } from "@/api/appointment";
import { getErrorMessage } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

interface QueueEntry {
  _id: string;
  patientId: { _id: string; name: string; profileImageUrl?: string } | string;
  doctorId: { _id: string; name: string } | string;
  appointmentDate: string;
  timeSlot: string;
  consultationType: "Initial" | "Follow-up" | "Acute";
  status: string;
}

export default function QueueBoard() {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuthStore();
  const isDoctor = user?.role === "doctor";

  const loadQueue = useCallback(
    async (showErrors: boolean) => {
      try {
        const response = await getArrivedAppointments({ scope: "today" });
        setQueue(response.data.data.appointments ?? []);
      } catch (err: unknown) {
        if (showErrors) toast.error(getErrorMessage(err, "Failed to load the queue"));
      }
    },
    []
  );

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    (async () => {
      await loadQueue(true);
      setLoading(false);
      interval = setInterval(() => loadQueue(false), 30000);
    })();
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loadQueue]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadQueue(false);
    setIsRefreshing(false);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Waiting Queue</h1>
          <p className="text-sm text-neutral-500">
            Patients who have arrived today, in slot order.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={isRefreshing ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Now Waiting ({queue.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : queue.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-10 text-center text-neutral-400">
              <Armchair className="size-5" /> Nobody is waiting right now.
            </p>
          ) : (
            <ol className="divide-y divide-neutral-100">
              {queue.map((entry, index) => {
                const patientName =
                  typeof entry.patientId === "string" ? "Unknown" : entry.patientId.name;
                const doctorName =
                  typeof entry.doctorId === "string" ? null : entry.doctorId.name;
                return (
                  <li key={entry._id} className="flex items-center gap-4 py-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {index + 1}
                    </span>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                      {patientName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-neutral-900">{patientName}</p>
                      <p className="text-sm text-neutral-500">
                        {entry.timeSlot} · {entry.consultationType}
                        {!isDoctor && doctorName ? ` · ${doctorName}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {entry.status}
                    </Badge>
                    {isDoctor ? (
                      <Button size="sm" asChild className="px-3">
                        <Link to={`/doctor/start-consultation/${entry._id}`}>
                          <Stethoscope className="size-4" /> Start
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/${user?.role}/appointments/${entry._id}`}>Details</Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
