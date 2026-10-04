import {
  CalendarDays,
  ClipboardList,
  FileImage,
  FileText,
  Pill,
  Stethoscope,
  Trash2,
} from "lucide-react";

import { Link } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { useAuthStore } from "@/store/authStore";

import { type Report, openReportFile } from "@/api/report";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";

import { type TimelineEntry } from "@/api/timeline";

const CATEGORY_LABELS: Record<Report["category"], string> = {
  lab: "Lab Report",
  imaging: "Imaging",
  test: "Test",
  other: "Other",
};

const FOLLOW_UP_META: Record<
  string,
  { label: string; chip: string }
> = {
  pending: { label: "Pending", chip: "bg-amber-50 text-amber-700" },
  overdue: { label: "Overdue", chip: "bg-red-50 text-red-600" },
  done: { label: "Done", chip: "bg-emerald-50 text-emerald-700" },
  skipped: { label: "Skipped", chip: "bg-neutral-100 text-neutral-500" },
};

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

interface TimelineEntryCardProps {
  entry: TimelineEntry;

  onDeleteReport?: (report: Report) => void;
}

export default function TimelineEntryCard({
  entry,

  onDeleteReport,
}: TimelineEntryCardProps) {
  const { user } = useAuthStore();

  const role = user?.role ?? "patient";

  const isDoctor = role === "doctor";

  if (entry.kind === "consultation") {
    const consultation = entry.consultation;

    const person = isDoctor
      ? consultation.patientId
      : consultation.doctorId;

    const complaint =
      [
        consultation.chiefComplaintDetails?.location,
        consultation.chiefComplaintDetails?.sensation,
      ]
        .filter(Boolean)
        .join(" — ") || "—";

    const followUp = consultation.followUpDate
      ? {
          label: formatDate(consultation.followUpDate),
          meta:
            FOLLOW_UP_META[consultation.followUpStatus ?? ""] ??
            FOLLOW_UP_META.pending,
        }
      : null;

    return (
      <Card className="w-full border border-neutral-200/70 bg-white shadow-xs rounded-xl dark:bg-neutral-900/50">
        <CardContent className="space-y-3 p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-sm font-bold text-neutral-900">
                Consultation
              </span>
              <Badge variant="outline" className="shrink-0">
                {consultation.appointmentId?.consultationType}
              </Badge>
            </div>
            <Button size="sm" variant="outline" asChild className="shrink-0">
              <Link
                to={`/${role}/consultation/${consultation.appointmentId?._id}`}
              >
                View
              </Link>
            </Button>
          </div>

          {/* Person (patient for doctors, doctor for patients) */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 text-xs font-semibold text-neutral-700">
              {person?.profileImageUrl ? (
                <img
                  src={person.profileImageUrl}
                  alt={person.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                person?.name?.charAt(0) ?? "?"
              )}
            </div>
            <div className="min-w-0">
              <span className="block text-[11px] font-medium text-muted-foreground">
                {isDoctor ? "Patient" : "Attending physician"}
              </span>
              <span className="block truncate text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                {person?.name ?? "—"}
              </span>
            </div>
          </div>

          {/* Complaint + Diagnosis */}
          <div className="grid grid-cols-1 gap-y-3 gap-x-2 sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <ClipboardList className="mt-0.5 size-4 shrink-0 text-neutral-400" />
              <div className="min-w-0">
                <span className="block text-[11px] font-medium text-muted-foreground">
                  Complaint
                </span>
                <span className="line-clamp-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {complaint}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Stethoscope className="mt-0.5 size-4 shrink-0 text-neutral-400" />
              <div className="min-w-0">
                <span className="block text-[11px] font-medium text-muted-foreground">
                  Diagnosis
                </span>
                <span className="line-clamp-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {consultation.diagnosis || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Footer chips: prescriptions + follow-up */}
          <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
            <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-600">
              <Pill className="size-3" />{" "}
              {consultation.prescriptions?.length ?? 0}{" "}
              {(consultation.prescriptions?.length ?? 0) === 1
                ? "prescription"
                : "prescriptions"}
            </span>
            {followUp && (
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${followUp.meta.chip}`}
              >
                <CalendarDays className="size-3" /> Follow-up{" "}
                {followUp.label} · {followUp.meta.label}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const report = entry.report;

  const canDelete =
    role !== "doctor" && Boolean(onDeleteReport);

  return (
    <Card className="w-full border border-neutral-200/70 bg-white shadow-xs rounded-xl dark:bg-neutral-900/50">
      <CardContent className="space-y-3 p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-neutral-900">
              {report.title}
            </h3>
            <p className="text-xs text-neutral-500">
              {formatDate(report.createdAt)} · Uploaded by{" "}
              {report.uploadedBy?.name ?? "Unknown"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant="outline" className="capitalize">
              {CATEGORY_LABELS[report.category]}
            </Badge>
            {canDelete && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => onDeleteReport?.(report)}
              >
                <Trash2 className="size-3" />
              </Button>
            )}
          </div>
        </div>

        {report.description ? (
          <p className="line-clamp-2 text-sm text-neutral-600">
            {report.description}
          </p>
        ) : null}

        {/* Files */}
        <div className="flex flex-wrap gap-2">
          {report.files.map((file, fileIndex) => {
            const isPdf = file.mimeType === "application/pdf";
            // PDFs are served from our API (they need the auth token), so
            // they open through a handler rather than an href.
            const needsFetch = !file.url;
            return (
              <button
                key={file.publicId ?? file.storageId ?? `${file.name}-${fileIndex}`}
                type="button"
                title={file.name}
                onClick={() => {
                  if (!needsFetch && file.url) {
                    window.open(file.url, "_blank", "noopener,noreferrer");
                    return;
                  }
                  openReportFile(report._id, fileIndex).catch((err) =>
                    toast.error(
                      getErrorMessage(err, "Could not open this file"),
                    ),
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-700 hover:border-primary/40 hover:bg-neutral-100 text-left"
              >
                {isPdf ? (
                  <FileText className="size-3.5 text-rose-500" />
                ) : (
                  <FileImage className="size-3.5 text-sky-500" />
                )}
                <span className="max-w-40 truncate">{file.name}</span>
                <span className="text-neutral-400">
                  ({formatBytes(file.size)})
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}