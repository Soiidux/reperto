import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CalendarPlus, History, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPatients } from "@/api/user";
import { getErrorMessage } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import getAge from "@/utils/getAge";

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

export default function PatientDirectory() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const canBook = user?.role === "staff" || user?.role === "admin";

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const response = await getPatients({ limit: 50 });
        setPatients(response.data.data);
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, "Failed to load patients"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const delay = setTimeout(() => {
      (async () => {
        setLoading(true);
        try {
          const response = await getPatients(search ? { search, limit: 50 } : { limit: 50 });
          if (search && response.data.data.length === 0) {
            toast.info("No patients match your search");
          }
          setPatients(response.data.data);
        } catch (err: unknown) {
          toast.error(getErrorMessage(err, "Failed to load patients"));
        } finally {
          setLoading(false);
        }
      })();
    }, 400);
    return () => clearTimeout(delay);
  }, [search]);

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
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Patients ({patients.length})</CardTitle>
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
    </div>
  );
}