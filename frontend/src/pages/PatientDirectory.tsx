import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CalendarPlus, ChevronLeft, ChevronRight, History, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPatients } from "@/api/user";
import { getErrorMessage } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import getAge from "@/utils/getAge";

const PAGE_SIZE = 15;

interface Patient {
  _id: string;
  name: string;
  email: string;
  phone: string;
  gender: "male" | "female" | "other";
  bloodGroup?: string;
  dateOfBirth?: string;
  profileImageUrl?: string;
}

interface Pagination {
  totalItems: number;
  currentPage: number;
  totalPages: number;
}

export default function PatientDirectory() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const canBook = user?.role === "staff" || user?.role === "admin";

  // Debounce keystrokes into a single search term; any new search restarts at page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    getPatients(
      { search: search || undefined, page, limit: PAGE_SIZE },
      { signal: controller.signal },
    )
      .then((response) => {
        if (controller.signal.aborted) return;
        setPatients(response.data.data ?? []);
        setPagination(
          response.data.pagination
            ? {
                totalItems: response.data.pagination.totalItems,
                currentPage: response.data.pagination.currentPage,
                totalPages: response.data.pagination.totalPages,
              }
            : null,
        );
        if (search && (response.data.data?.length ?? 0) === 0) {
          toast.info("No patients match your search");
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if ((err as { code?: string })?.code === "ERR_CANCELED") return;
        toast.error(getErrorMessage(err, "Failed to load patients"));
        setLoading(false);
      });
    // Out-of-order responses for superseded requests are dropped via abort
    return () => controller.abort();
  }, [search, page]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Patient Directory</h1>
        <p className="text-sm text-neutral-500">Browse registered patients and open their case history.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <Input
          placeholder="Search by name, email, or phone"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Patients ({pagination?.totalItems ?? patients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : patients.length === 0 ? (
            <p className="py-8 text-center text-neutral-400">No patients found.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {patients.map((patient) => (
                <li key={patient._id} className="flex items-center gap-4 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                    {patient.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900">{patient.name}</p>
                    <p className="text-sm text-neutral-500">
                      {patient.phone} · {patient.email} · {patient.dateOfBirth ? getAge(patient.dateOfBirth) : "—"}y ·{" "}
                      {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
                    </p>
                  </div>
                  {canBook && (
                    <Link
                      to={`/${user?.role}/book-appointment?patientId=${patient._id}&patientName=${encodeURIComponent(patient.name)}`}
                    >
                      <Button variant="outline" size="sm">
                        <CalendarPlus className="size-4" /> Book
                      </Button>
                    </Link>
                  )}
                  <Link to={`/doctor/consultation/history/${patient._id}`}>
                    <Button variant="outline" size="sm">
                      <History className="size-4" /> View History
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft /> Prev
          </Button>
          <span className="text-sm text-neutral-500">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.currentPage >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}