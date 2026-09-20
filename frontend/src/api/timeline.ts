import { getPatientHistory } from "./consultation";
import { getPatientReports, type Report } from "./report";

export interface TimelineConsultation {
  _id: string;

  appointmentId: {
    _id: string;

    appointmentDate: string;

    consultationType:
      | "Initial"
      | "Follow-up"
      | "Acute";
  };

  patientId: {
    _id: string;

    name: string;

    profileImageUrl?: string;
  };

  doctorId: {
    _id: string;

    name: string;

    profileImageUrl?: string;
  };

  chiefComplaintDetails: {
    location: string;

    sensation: string;
  };

  diagnosis: string;

  prescriptions: {
    remedyName: string;

    potency: string | null;

    dosage: string;

    durationInDays: number;
  }[];

  followUpDate?: string | null;
  followUpStatus?: string;
  createdAt?: string;
}

export type TimelineEntry =
  | {
      kind: "consultation";
      id: string;
      date: string;
      consultation: TimelineConsultation;
    }
  | { kind: "report"; id: string; date: string; report: Report };

export interface PatientTimeline {
  count: number;
  consultations: number;
  reports: number;
  entries: TimelineEntry[];
}

// One chronological "medical history": consultations (visit date) and
// uploaded reports (upload date) merged and sorted newest-first. Both
// underlying endpoints already enforce access (patient self/family via
// canActForPatient, doctors may open any patient), so no backend change.
export const getPatientTimeline = async (
  patientId: string,
): Promise<PatientTimeline> => {
  const [historyResponse, reportsResponse] = await Promise.all([
    getPatientHistory(patientId),
    getPatientReports(patientId),
  ]);

  const history: TimelineConsultation[] =
    historyResponse.data?.data?.history ?? [];
  const reports: Report[] = reportsResponse.data?.data?.reports ?? [];

  const consultationEntries: TimelineEntry[] = history.map(
    (consultation) => ({
      kind: "consultation",
      id: consultation._id,
      date:
        consultation.appointmentId?.appointmentDate ??
        consultation.createdAt ??
        "",
      consultation,
    }),
  );

  const reportEntries: TimelineEntry[] = reports.map((report) => ({
    kind: "report",
    id: report._id,
    date: report.createdAt,
    report,
  }));

  const entries = [...consultationEntries, ...reportEntries]
    .filter((entry) => entry.date)
    .sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

  return {
    count: entries.length,
    consultations: consultationEntries.length,
    reports: reportEntries.length,
    entries,
  };
};