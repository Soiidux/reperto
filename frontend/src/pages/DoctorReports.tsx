import { useParams } from "react-router-dom";
import ReportsPage from "@/components/ReportsPage";

export default function DoctorReports() {
  const { patientId } = useParams<{ patientId: string }>();
  return <ReportsPage patientId={patientId ?? ""} allowUpload={false} />;
}