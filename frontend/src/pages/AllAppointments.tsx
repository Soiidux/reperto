import AppointmentCard from "@/components/AppointmentCard";
import { getAllAppointments } from "@/api/appointment";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/utils";

const PAGE_SIZE = 9;

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "arrived", label: "Arrived" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no-show", label: "No Show" },
];

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

interface Pagination {
  totalItems: number;
  currentPage: number;
  totalPages: number;
}

export default function AllAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const { user } = useAuthStore();

  // Debounce keystrokes into a single search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Abortable fetch: state updates happen asynchronously in the promise
  // chain so a filter change can't cascade-render mid-effect.
  useEffect(() => {
    const controller = new AbortController();
    getAllAppointments(
      {
        status: status !== "all" ? status : undefined,
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      },
      { signal: controller.signal },
    )
      .then((response) => {
        if (controller.signal.aborted) return;
        setAppointments(response.data.data.appointments ?? []);
        setPagination(response.data.data.pagination ?? null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if ((err as { code?: string })?.code === "ERR_CANCELED") return;
        toast.error(getErrorMessage(err, "Failed to load appointments"));
        setLoading(false);
      });
    return () => controller.abort();
  }, [search, status, page]);

  const totalPages = pagination?.totalPages ?? 1;
  const showingRange =
    pagination && pagination.totalItems > 0
      ? `${(pagination.currentPage - 1) * PAGE_SIZE + 1}-${Math.min(
          pagination.currentPage * PAGE_SIZE,
          pagination.totalItems,
        )} of ${pagination.totalItems}`
      : "0";

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-gray-500">
          Showing {showingRange} appointments
        </span>
        <span className="text-sm text-gray-500 hover:text-gray-800 hover:underline hover:cursor-pointer"><Link to={`/${user?.role}/appointments`}>View Upcoming</Link></span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search by patient or doctor name"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <p>No appointments found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {appointments.map((appointment) => (
            <AppointmentCard
              key={appointment._id}
              {...appointment}
            />
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && !loading && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination || pagination.currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft /> Prev
          </Button>
          <span className="text-sm text-neutral-500">
            Page {pagination.currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination || pagination.currentPage >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}
