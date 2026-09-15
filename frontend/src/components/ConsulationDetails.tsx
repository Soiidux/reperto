import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

import {
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "./ui/field";

import { useEffect, useState } from "react";

import { useParams } from "react-router-dom";

import {
  Calendar,
  CalendarClockIcon,
  Clock,
  Hourglass,
  User,
  VenusAndMars,
  CheckCircle,
  NotepadText,
  LucideTimer,
  Pill,
  History,
  MapPin,
  Activity,
  ArrowUp,
  ArrowDown,
  Thermometer,
  GlassWater,
  Utensils,
  Bed,
  Brain,
  Stethoscope,
  FileText,
  FolderOpen,
  ReceiptText,
  Loader2,
} from "lucide-react";

import { getAppointmentById } from "@/api/appointment";
import { getConsultation, getPrescription } from "@/api/consultation";
import { generateInvoice, getInvoicePdf } from "@/api/invoice";
import { getReviewList, saveReview, deleteReview, type Review } from "@/api/review";
import { useAuthStore } from "@/store/authStore";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { RatingStars } from "./RatingStars";
import { Link } from "react-router-dom";

import getAge from "@/utils/getAge";

interface Appointment {
  _id: string;

  patientId: {
    _id: string;
    name: string;
    gender: string;
    dateOfBirth: string;
    profileImageUrl?: string;
  };

  doctorId: {
    _id: string;
    name: string;
    profileImageUrl?: string;
  };

  appointmentDate: string;

  timeSlot: string;

  durationInMinutes: number;

  status:
    | "pending"
    | "arrived"
    | "completed"
    | "cancelled"
    | "no-show";

  consultationType: "Initial" | "Follow-up" | "Acute";

  intakeDetails: {
    primaryComplaint: string;
    duration: string;
    currentMedication: string;
    pastMedicalHistory: string;
  };

  cancellationReason: string;
}

interface Consultation {
  _id: string;

  appointmentId: string;

  patientId: string;

  doctorId: {
    _id: string;
    name: string;
    profileImageUrl?: string;
  };

  chiefComplaintDetails: {
    location: string;

    sensation: string;

    modalities: {
      Aggravation: string;

      Amlioration: string;
    };

    concomitants: string;
  };

  pastMedicalHistory: string;

  physicalGenerals: {
    thermals: string;

    thirst: string;

    appetiteAndCravings: string;

    sleepAndDreams: string;
  };

  mentalGenerals: string;

  diagnosis: string;

  prescriptions: {
    remedyName: string;

    potency: string | null;

    dosage: string;

    durationInDays: number;
  }[];

  doctorNotes: string;
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;

  label: string;

  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border p-5 min-h-24">
      <div className="text-neutral-400 shrink-0">{icon}</div>

      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground font-medium">
          {label}
        </span>

        <span className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
          {value}
        </span>
      </div>
    </div>
  );
}

export default function ConsultationDetails() {
  const { id } = useParams<{
    id: string;
  }>();

  const [appointmentData, setAppointmentData] =
    useState<Appointment>();

  const [consultationData, setConsultationData] =
    useState<Consultation>();

const { user } = useAuthStore();

const [reviews, setReviews] = useState<Review[]>([]);
const [rating, setRating] = useState(0);
const [comment, setComment] = useState("");
const [saving, setSaving] = useState(false);
const [deleting, setDeleting] = useState(false);

const downloadPrescription = async () => {
    if (!consultationData) return;
    try {
      const response = await getPrescription(consultationData._id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `prescription-${appointmentData?.patientId?.name?.replace(/\s+/g, "-").toLowerCase() || "patient"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Prescription downloaded");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to download prescription"));
    }
  };

  const printPrescription = async () => {
    if (!consultationData) return;
    try {
      const response = await getPrescription(consultationData._id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const win = window.open("", "_blank");
      if (!win) {
        toast.error("Pop-up blocked. Please allow pop-ups to print the prescription.");
        return;
      }
      win.document.write(
        `<html><head><title>Prescription</title>` +
          `<style>body{margin:0}#pdf{width:100%;height:100%;border:0}</style>` +
          `</head><body><iframe id="pdf" src="${url}"></iframe></body></html>`,
      );
      win.document.close();
      win.focus();
      // Give the embedded PDF a moment to render before exposing print.
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          // Print may be blocked while the PDF renders; the tab stays open.
        }
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      }, 600);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to open prescription"));
    }
  };

  const [invoiceInfo, setInvoiceInfo] = useState<{ _id: string } | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  // Fetch (or backfill) the invoice for this consultation once the
  // consultation record is known.
  useEffect(() => {
    if (!consultationData?._id) return;
    let cancelled = false;
    const load = async () => {
      setInvoiceLoading(true);
      try {
        const resp = await generateInvoice(consultationData._id);
        if (cancelled) return;
        setInvoiceInfo(resp.data.data);
      } catch {
        // Older records may not have an invoice; leave the buttons hidden.
      } finally {
        if (!cancelled) setInvoiceLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [consultationData?._id]);

  const openInvoice = async (download: boolean) => {
    if (!invoiceInfo) return;
    try {
      const response = await getInvoicePdf(invoiceInfo._id, download);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      if (download) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `invoice-${invoiceInfo._id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success("Invoice downloaded");
      } else {
        const win = window.open("", "_blank");
        if (!win) {
          toast.error("Pop-up blocked. Please allow pop-ups to print the invoice.");
          return;
        }
        win.document.write(
          `<html><head><title>Invoice</title>` +
            `<style>body{margin:0}#pdf{width:100%;height:100%;border:0}</style>` +
            `</head><body><iframe id="pdf" src="${url}"></iframe></body></html>`,
        );
        win.document.close();
        win.focus();
        setTimeout(() => {
          try {
            win.focus();
            win.print();
          } catch {
            // Print may be blocked while the PDF renders; the tab stays open.
          }
          setTimeout(() => window.URL.revokeObjectURL(url), 60000);
        }, 600);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to open invoice"));
    }
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const fetchData = async () => {
      try {
        const appointmentResponse =
          await getAppointmentById(id);

        const appointment =
          appointmentResponse.data.data;

        if (cancelled) return;
        setAppointmentData(appointment);

        const consultationResponse =
          await getConsultation(
            appointment.patientId._id,
            id
          );

        if (cancelled) return;
        setConsultationData(
          consultationResponse.data.data
        );
      } catch (error) {
        console.error(error);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Doctor reviews: fetch once the doctor is known and prefill the
  // patient's own rating so they can edit/remove it.
  const doctorId = appointmentData?.doctorId?._id;
  useEffect(() => {
    if (!doctorId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await getReviewList(doctorId);
        const list: Review[] = resp.data.data || [];
        if (cancelled) return;
        setReviews(list);
        const mine = user?.id
          ? list.find((r) => r.patientId._id === user.id)
          : undefined;
        if (mine) {
          setRating(mine.rating);
          setComment(mine.comment || "");
        }
      } catch {
        // Reviews are secondary to the consultation view.
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [doctorId, user?.id]);

  const handleSaveReview = async () => {
    if (!appointmentData || rating < 1) return;
    setSaving(true);
    try {
      const resp = await saveReview({
        doctorId: appointmentData.doctorId._id,
        rating,
        comment,
      });
      toast.success(resp.data.message || "Review saved");
      const listResp = await getReviewList(appointmentData.doctorId._id);
      setReviews(listResp.data.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not save the review."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!appointmentData) return;
    setDeleting(true);
    try {
      await deleteReview(appointmentData.doctorId._id);
      setReviews((rs) => rs.filter((r) => r.patientId._id !== user?.id));
      setRating(0);
      setComment("");
      toast.success("Review removed");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not remove the review."));
    } finally {
      setDeleting(false);
    }
  };

  if (!appointmentData || !consultationData) {
    return (
      <div className="w-full max-w-5xl mx-auto p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-3xl">
              Consultation Details
            </CardTitle>

            <CardDescription className="text-center">
              Loading...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const {
    _id,
    patientId: patient,
    doctorId: doctor,
    appointmentDate,
    timeSlot,
    durationInMinutes,
    status,
    consultationType,
    intakeDetails,
  } = appointmentData;

  const {
    chiefComplaintDetails,
    physicalGenerals,
    mentalGenerals,
    diagnosis,
    prescriptions,
    doctorNotes,
    pastMedicalHistory,
  } = consultationData;

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6">
      <Card className="shadow-md border-neutral-100">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-bold">
            Consultation Details
          </CardTitle>

          <CardDescription className="text-center text-xl font-semibold">
            Appointment Id : {_id}
          </CardDescription>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={downloadPrescription}>
              <FileText className="mr-2 size-4" /> Download Prescription
            </Button>
            <Button variant="outline" size="sm" onClick={printPrescription}>
              <FileText className="mr-2 size-4" /> Print Prescription
            </Button>
            {!invoiceLoading && invoiceInfo && (
              <>
                <Button variant="outline" size="sm" onClick={() => openInvoice(true)}>
                  <ReceiptText className="mr-2 size-4" /> Download Invoice
                </Button>
                <Button variant="outline" size="sm" onClick={() => openInvoice(false)}>
                  <ReceiptText className="mr-2 size-4" /> Print Invoice
                </Button>
              </>
            )}
            {invoiceLoading && (
              <Button variant="outline" size="sm" disabled>
                <Loader2 className="mr-2 size-4 animate-spin" /> Invoice…
              </Button>
            )}
            {user?.role === "doctor" && (
              <Button variant="outline" size="sm">
                <Link to={`/doctor/reports/${patient._id}`}>
                  <FolderOpen className="mr-2 size-4" /> View Reports
                </Link>
              </Button>
            )}
            {user?.role === "patient" && (
              <Button size="sm">
                <Link to={`/patient/book-appointment?doctorId=${doctor._id}&type=Follow-up`}>
                  Book Follow-up
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          <FieldSeparator />

          {/* Patient Information */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Patient Information
            </FieldLegend>

            <div className="flex items-center gap-4">
              <div className="w-56 h-56 rounded-lg overflow-hidden border">
                <img
                  src={patient.profileImageUrl}
                  alt="Patient"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-6 w-full">
                <InfoCard
                  icon={<User size={20} />}
                  label="Name"
                  value={patient.name}
                />

                <InfoCard
                  icon={<Calendar size={20} />}
                  label="Age"
                  value={getAge(patient.dateOfBirth)}
                />

                <InfoCard
                  icon={<VenusAndMars size={20} />}
                  label="Gender"
                  value={
                    patient.gender.charAt(0).toUpperCase() +
                    patient.gender.slice(1)
                  }
                />
              </div>
            </div>
          </FieldSet>

          {/* Appointment Information */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Appointment Details
            </FieldLegend>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="w-32 h-32 rounded-lg overflow-hidden border">
                <img
                  src={doctor.profileImageUrl}
                  alt="Doctor"
                  className="w-full h-full object-cover"
                />
              </div>

              <InfoCard
                icon={<User size={20} />}
                label="Doctor Name"
                value={doctor.name}
              />

              <InfoCard
                icon={<CalendarClockIcon size={20} />}
                label="Date"
                value={new Date(
                  appointmentDate
                ).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              />

              <InfoCard
                icon={<Clock size={20} />}
                label="Time Slot"
                value={timeSlot}
              />

              <InfoCard
                icon={<Hourglass size={20} />}
                label="Duration"
                value={`${durationInMinutes} minutes`}
              />

              <InfoCard
                icon={<CheckCircle size={20} />}
                label="Status"
                value={
                  status.charAt(0).toUpperCase() +
                  status.slice(1)
                }
              />

              <InfoCard
                icon={<Stethoscope size={20} />}
                label="Consultation Type"
                value={consultationType}
              />
            </div>
          </FieldSet>

          {/* Intake Details */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Intake Details
            </FieldLegend>

            <div className="grid gap-4">
              <InfoCard
                icon={<NotepadText size={20} />}
                label="Primary Complaint"
                value={intakeDetails.primaryComplaint}
              />

              <InfoCard
                icon={<LucideTimer size={20} />}
                label="Duration"
                value={intakeDetails.duration}
              />

              <InfoCard
                icon={<Pill size={20} />}
                label="Current Medication"
                value={intakeDetails.currentMedication}
              />

              <InfoCard
                icon={<History size={20} />}
                label="Past Medical History"
                value={intakeDetails.pastMedicalHistory}
              />
            </div>
          </FieldSet>

          {/* Chief Complaint */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Chief Complaint Details
            </FieldLegend>

            <div className="grid gap-4">
              <InfoCard
                icon={<MapPin size={20} />}
                label="Location"
                value={chiefComplaintDetails.location}
              />

              <InfoCard
                icon={<Activity size={20} />}
                label="Sensation"
                value={chiefComplaintDetails.sensation}
              />

              <InfoCard
                icon={<ArrowUp size={20} />}
                label="Aggravation"
                value={
                  chiefComplaintDetails.modalities
                    .Aggravation
                }
              />

              <InfoCard
                icon={<ArrowDown size={20} />}
                label="Amelioration"
                value={
                  chiefComplaintDetails.modalities
                    .Amlioration
                }
              />

              <InfoCard
                icon={<Activity size={20} />}
                label="Concomitants"
                value={chiefComplaintDetails.concomitants}
              />
            </div>
          </FieldSet>

          {/* Consultation PMH */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Consultation Past Medical History
            </FieldLegend>

            <InfoCard
              icon={<History size={20} />}
              label="Past Medical History"
              value={pastMedicalHistory}
            />
          </FieldSet>

          {/* Physical Generals */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Physical Generals
            </FieldLegend>

            <div className="grid gap-4">
              <InfoCard
                icon={<Thermometer size={20} />}
                label="Thermals"
                value={physicalGenerals.thermals}
              />

              <InfoCard
                icon={<GlassWater size={20} />}
                label="Thirst"
                value={physicalGenerals.thirst}
              />

              <InfoCard
                icon={<Utensils size={20} />}
                label="Appetite & Cravings"
                value={
                  physicalGenerals.appetiteAndCravings
                }
              />

              <InfoCard
                icon={<Bed size={20} />}
                label="Sleep & Dreams"
                value={physicalGenerals.sleepAndDreams}
              />
            </div>
          </FieldSet>

          {/* Mental Generals */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Mental Generals
            </FieldLegend>

            <InfoCard
              icon={<Brain size={20} />}
              label="Mental Generals"
              value={mentalGenerals}
            />
          </FieldSet>

          {/* Diagnosis */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Diagnosis
            </FieldLegend>

            <InfoCard
              icon={<Stethoscope size={20} />}
              label="Diagnosis"
              value={diagnosis}
            />
          </FieldSet>

          {/* Prescriptions */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Prescriptions
            </FieldLegend>

            <div className="space-y-4">
              {prescriptions.map((item, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-5 space-y-4"
                >
                  <h3 className="font-semibold text-lg">
                    Prescription {index + 1}
                  </h3>

                  <InfoCard
                    icon={<Pill size={20} />}
                    label="Remedy Name"
                    value={item.remedyName}
                  />

                  <InfoCard
                    icon={<Pill size={20} />}
                    label="Potency"
                    value={item.potency ?? "-"}
                  />

                  <InfoCard
                    icon={<Pill size={20} />}
                    label="Dosage"
                    value={item.dosage}
                  />

                  <InfoCard
                    icon={<Calendar size={20} />}
                    label="Duration"
                    value={`${item.durationInDays} days`}
                  />
                </div>
              ))}
            </div>
          </FieldSet>

          {/* Doctor Notes */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Doctor Notes
            </FieldLegend>

            <InfoCard
              icon={<FileText size={20} />}
              label="Doctor Notes"
              value={doctorNotes}
            />
          </FieldSet>

          {/* Doctor Reviews */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Doctor Reviews
            </FieldLegend>

            {user?.role === "patient" && (
              <div className="border rounded-lg p-5 space-y-3">
                <p className="font-semibold text-sm">
                  Your rating for {doctor.name}
                </p>
                <RatingStars value={rating} onChange={setRating} size={22} />
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share your experience (optional)"
                  maxLength={1000}
                  className="min-h-20"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={saving || rating < 1}
                    onClick={handleSaveReview}
                  >
                    {saving
                      ? "Saving…"
                      : rating > 0
                        ? "Save review"
                        : "Select a rating"}
                  </Button>
                  {reviews.some((r) => r.patientId._id === user?.id) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDeleteReview}
                      disabled={deleting}
                    >
                      Remove my review
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {reviews.length === 0 && (
                <p className="text-sm text-muted-foreground">No reviews yet.</p>
              )}
              {reviews.map((r) => (
                <div key={r._id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {r.patientId.profileImageUrl ? (
                        <img
                          src={r.patientId.profileImageUrl}
                          alt={r.patientId.name}
                          className="h-8 w-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                          {r.patientId.name.charAt(0)}
                        </div>
                      )}
                      <span className="font-semibold text-sm truncate">
                        {r.patientId.name}
                      </span>
                    </div>
                    <RatingStars value={r.rating} size={14} />
                  </div>
                  {r.comment && (
                    <p className="text-sm text-neutral-600">{r.comment}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </FieldSet>
        </CardContent>
      </Card>
    </div>
  );
}