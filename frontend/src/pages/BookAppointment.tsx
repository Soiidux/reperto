import { useSearchParams } from "react-router-dom";
import AppointmentForm from "@/components/AppointmentForm";

export default function BookAppointment() {
  const [searchParams] = useSearchParams();
  const doctorId = searchParams.get("doctorId") || "";
  const type = searchParams.get("type");
  const patientId = searchParams.get("patientId") || "";
  const patientName = searchParams.get("patientName") || "";

  return (
    <div>
      <AppointmentForm
        defaultDoctorId={doctorId}
        defaultType={type === "Follow-up" ? "Follow-up" : "Initial"}
        defaultPatientId={patientId}
        defaultPatientName={patientName}
      />
    </div>
  );
}
