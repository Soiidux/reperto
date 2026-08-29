import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FileImage,
  FileText,
  FolderOpen,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldLabel, Field } from "@/components/ui/field";
import { useAuthStore } from "@/store/authStore";
import { getErrorMessage } from "@/lib/utils";
import {
  type Report,
  deleteReport,
  getPatientReports,
  uploadReport,
} from "@/api/report";

const CATEGORY_LABELS: Record<Report["category"], string> = {
  lab: "Lab Report",
  imaging: "Imaging",
  test: "Test",
  other: "Other",
};

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

interface ReportsPageProps {
  patientId: string;
  patientName?: string;
  allowUpload: boolean;
  memberSwitcher?: React.ReactNode;
}

export default function ReportsPage({
  patientId,
  patientName,
  allowUpload,
  memberSwitcher,
}: ReportsPageProps) {
  const { user } = useAuthStore();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!patientId) return;
    try {
      setLoading(true);
      const response = await getPatientReports(patientId);
      setReports(response.data?.data?.reports ?? []);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to load reports"));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    let active = true;
    getPatientReports(patientId)
      .then((response) => {
        if (!active) return;
        setReports(response.data?.data?.reports ?? []);
      })
      .catch((err: unknown) => {
        if (!active) return;
        toast.error(getErrorMessage(err, "Failed to load reports"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [patientId]);

  const handleDelete = async (report: Report) => {
    if (!window.confirm(`Delete "${report.title}" and its attached files?`)) return;
    try {
      await deleteReport(report._id);
      toast.success("Report deleted");
      setReports((prev) => prev.filter((r) => r._id !== report._id));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete report"));
    }
  };

  const canDelete = user?.role !== "doctor";

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-neutral-900">
            <FolderOpen className="size-5 text-primary" /> Patient Reports
          </h1>
          <p className="text-sm text-neutral-500">
            Lab results and scans attached for {patientName ?? "the patient"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {memberSwitcher}
          {allowUpload && (
            <ReportUploadSheet
              patientId={patientId}
              includePatientId={
                Boolean(patientId && patientId !== user?.id) ||
                user?.role === "staff" ||
                user?.role === "admin"
              }
              onUploaded={refresh}
            />
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-400">
          <Loader2 className="size-4 animate-spin" /> Loading reports…
        </div>
      ) : reports.length === 0 ? (
        <p className="py-16 text-center text-neutral-400">
          No reports yet. {allowUpload ? "Attach the first one above." : ""}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reports.map((report) => (
            <Card key={report._id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b border-neutral-100 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-neutral-900">
                    {report.title}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {formatDate(report.createdAt)} ·{" "}
                    {report.uploadedBy?.name || "Unknown"}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 capitalize">
                  {CATEGORY_LABELS[report.category]}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 px-4 py-3">
                {report.description ? (
                  <p className="text-sm text-neutral-600 line-clamp-2">
                    {report.description}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {report.files.map((file) => {
                    const isPdf = file.mimeType === "application/pdf";
                    return (
                      <a
                        key={file.publicId}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-700 hover:border-primary/40 hover:bg-neutral-100"
                        title={file.name}
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
                      </a>
                    );
                  })}
                </div>
                {canDelete && (
                  <div className="flex justify-end border-t border-neutral-100 pt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(report)}
                      className="h-7 text-xs text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3 mr-1" /> Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportUploadSheet({
  patientId,
  includePatientId,
  onUploaded,
}: {
  patientId: string;
  includePatientId: boolean;
  onUploaded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (includePatientId) data.append("patientId", patientId);
    setIsSaving(true);
    try {
      await uploadReport(data);
      toast.success("Report uploaded");
      form.reset();
      setFiles([]);
      setOpen(false);
      onUploaded();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to upload report"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="size-4 mr-1" /> Upload Report
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Upload report</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Field>
            <FieldLabel>Title *</FieldLabel>
            <Input name="title" required placeholder="e.g. Complete Blood Count" />
          </Field>
          <Field>
            <FieldLabel>Category *</FieldLabel>
            <Select name="category" required>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lab">Lab Report</SelectItem>
                <SelectItem value="imaging">Imaging / Scan</SelectItem>
                <SelectItem value="test">Test</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Description</FieldLabel>
            <Textarea
              name="description"
              rows={3}
              placeholder="Anything the doctor should know about this report"
            />
          </Field>
          <Field>
            <FieldLabel>Files * (PDF or image, up to 5, 10 MB each)</FieldLabel>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose files
              </Button>
              {files.length > 0 && (
                <span className="text-xs text-neutral-500 truncate">
                  {files.map((f) => f.name).join(", ")}
                </span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              name="files"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </Field>
          <Button type="submit" disabled={isSaving} className="w-full">
            {isSaving ? "Uploading…" : "Upload report"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}