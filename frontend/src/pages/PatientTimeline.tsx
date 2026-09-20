import { useEffect, useMemo, useState } from "react";

import { Link, useParams } from "react-router-dom";

import { toast } from "sonner";

import {
  Activity,
  FileText,
  FolderOpen,
  Search,
  Stethoscope,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Skeleton } from "@/components/ui/skeleton";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAuthStore } from "@/store/authStore";

import { getErrorMessage } from "@/lib/utils";

import { type FamilyMember, getFamilyMembers } from "@/api/user";

import {
  getPatientTimeline,
  type PatientTimeline,
  type TimelineEntry,
} from "@/api/timeline";

import { type Report, deleteReport } from "@/api/report";

import TimelineEntryCard from "@/components/TimelineEntryCard";

type TimelineFilter = "all" | "consultation" | "report";

const GROUP_FILTERS: { key: TimelineFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "consultation", label: "Consultations" },
  { key: "report", label: "Reports" },
];

// "YYYY-MM-DD" group keys come from UTC-serialized dates, so the human label
// is rendered in UTC too to avoid timezone drift (same choice as the cards).
const groupDayLabel = (key: string): string => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (key === today) return "Today";
  const yesterday = new Date(
    now.getTime() - 24 * 60 * 60 * 1000,
  ).toISOString().slice(0, 10);
  if (key === yesterday) return "Yesterday";
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

export default function PatientTimeline() {
  const { user } = useAuthStore();

  const { patientId: paramPatientId } = useParams<{
    patientId: string;
  }>();

  const isPatient = user?.role === "patient";

  // Patients view themselves (or a family member via the switcher);
  // doctors arrive with a patientId in the URL.
  const viewerPatientId = isPatient
    ? user?.id ?? ""
    : (paramPatientId ?? "");

  const [members, setMembers] = useState<FamilyMember[]>([]);

  const [selectedId, setSelectedId] = useState<string>(user?.id ?? "");

  const patientId = isPatient ? selectedId : viewerPatientId;

  const [timeline, setTimeline] = useState<PatientTimeline | null>(null);

  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<TimelineFilter>("all");

  const [searchInput, setSearchInput] = useState("");

  // Family members so guardians can open any dependent's history
  useEffect(() => {
    let active = true;
    getFamilyMembers()
      .then((response) => {
        if (!active) return;
        const list: FamilyMember[] = response.data?.data ?? [];
        setMembers(list.filter((m) => m.isActive));
      })
      .catch((err: unknown) => {
        if (!active) return;
        toast.error(getErrorMessage(err, "Failed to load family members"));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!patientId) return;
    let active = true;
    setLoading(true);
    getPatientTimeline(patientId)
      .then((merged) => {
        if (active) setTimeline(merged);
      })
      .catch((err: unknown) => {
        if (active) {
          toast.error(getErrorMessage(err, "Failed to load medical history"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [patientId]);

  const search = searchInput.trim().toLowerCase();

  const visibleEntries = useMemo(() => {
    if (!timeline) return [];
    return timeline.entries.filter((entry) => {
      if (filter === "consultation" && entry.kind !== "consultation")
        return false;
      if (filter === "report" && entry.kind !== "report") return false;
      if (!search) return true;
      const haystack =
        entry.kind === "consultation"
          ? [
              typeof entry.consultation.doctorId === "object"
                ? entry.consultation.doctorId?.name
                : "",
              entry.consultation.diagnosis,
              entry.consultation.appointmentId?.consultationType,
              entry.consultation.chiefComplaintDetails?.location,
              entry.consultation.chiefComplaintDetails?.sensation,
            ]
          : [
              entry.report.title,
              entry.report.description ?? "",
              entry.report.category,
              entry.report.uploadedBy?.name ?? "",
            ];
      return haystack.join(" ").toLowerCase().includes(search);
    });
  }, [timeline, filter, search]);

  const groups = useMemo(() => {
    const byDay = new Map<string, TimelineEntry[]>();
    for (const entry of visibleEntries) {
      const dayKey = entry.date.slice(0, 10);
      const list = byDay.get(dayKey) ?? [];
      list.push(entry);
      byDay.set(dayKey, list);
    }
    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, entries]) => ({ key, entries }));
  }, [visibleEntries]);

  const handleDeleteReport = async (report: Report) => {
    if (
      !window.confirm(`Delete "${report.title}" and its attached files?`)
    ) {
      return;
    }
    try {
      await deleteReport(report._id);
      toast.success("Report deleted");
      setTimeline((prev) =>
        prev
          ? {
              ...prev,
              count: prev.count - 1,
              reports: prev.reports - 1,
              entries: prev.entries.filter(
                (entry) =>
                  !(entry.kind === "report" && entry.id === report._id),
              ),
            }
          : prev,
      );
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete report"));
    }
  };

  const viewingAnother =
    isPatient && selectedId !== "" && selectedId !== user?.id;

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-neutral-900">
            <Activity className="size-5 text-primary" /> Medical History
          </h1>
          <p className="text-sm text-neutral-500">
            {timeline
              ? `${timeline.consultations} ${
                  timeline.consultations === 1
                    ? "consultation"
                    : "consultations"
                } · ${timeline.reports} ${
                  timeline.reports === 1 ? "report" : "reports"
                } in one chronological view.`
              : "All consultations and reports in one place."}
          </p>
          {viewingAnother && (
            <p className="mt-1 rounded-md bg-primary/5 px-2 py-1 text-xs font-medium text-primary">
              Viewing history for{" "}
              {members.find((m) => m._id === selectedId)?.name ??
                "a family member"}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <Input
              placeholder="Search by doctor, diagnosis, title…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>

          {isPatient && members.length > 0 && (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Family member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={user?.id ?? ""}>
                  {user?.name ?? "Me"}
                </SelectItem>
                {members.map((m) => (
                  <SelectItem key={m._id} value={m._id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button size="sm" variant="outline" asChild>
            <Link
              to={
                isPatient
                  ? "/patient/reports"
                  : `/doctor/reports/${patientId}`
              }
            >
              <FolderOpen className="size-4 mr-1" /> Open Reports
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {GROUP_FILTERS.map((f) => {
          const count =
            f.key === "all"
              ? (timeline?.count ?? 0)
              : f.key === "consultation"
                ? (timeline?.consultations ?? 0)
                : (timeline?.reports ?? 0);
          return (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="ml-1.5 opacity-70">{count}</span>
            </Button>
          );
        })}
      </div>

      {/* Timeline body */}
      {loading ? (
        <div className="space-y-6 pt-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Activity className="size-8 text-neutral-300" />
          <p className="text-neutral-400">
            {search || filter !== "all"
              ? "Nothing matches your search."
              : isPatient
                ? "No medical history yet."
                : "No recorded visits or reports for this patient yet."}
          </p>
          {!search && filter === "all" && isPatient && (
            <Button size="sm" variant="outline" asChild>
              <Link to="/patient/reports">
                <FolderOpen className="size-4 mr-1" /> Go to My Reports
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col">
          {groups.map((group) => (
            <section key={group.key}>
              {/* Date header */}
              <div className="flex items-center gap-3 py-3">
                <div className="h-px flex-1 bg-neutral-200" />
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {groupDayLabel(group.key)}
                </span>
                <div className="h-px flex-1 bg-neutral-200" />
              </div>

              {/* Rail + entries */}
              <div className="relative">
                <div
                  aria-hidden
                  className="absolute bottom-3 left-[18px] top-3 w-px bg-neutral-200"
                />
                <div className="flex flex-col">
                  {group.entries.map((entry) => (
                    <div key={entry.id} className="relative pb-6 pl-14">
                      <div className="absolute left-0 top-0 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm">
                        {entry.kind === "consultation" ? (
                          <Stethoscope className="size-4 text-primary" />
                        ) : (
                          <FileText className="size-4 text-sky-500" />
                        )}
                      </div>
                      <TimelineEntryCard
                        entry={entry}
                        onDeleteReport={
                          entry.kind === "report"
                            ? handleDeleteReport
                            : undefined
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}