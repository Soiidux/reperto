import { useSearchParams } from "react-router-dom";
import AppointmentForm from "@/components/AppointmentForm";
import BookingWizard from "@/components/BookingWizard";
import { useAuthStore } from "@/store/authStore";

// Patients get the movie-style booking wizard (pick a time chip, slot is held
// for 5 min, then confirm). Staff/admin keep the direct form for walk-ins.
export default function BookAppointment() {
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const doctorId = searchParams.get("doctorId") || "";
  const type = searchParams.get("type");
  const patientId = searchParams.get("patientId") || "";
  const patientName = searchParams.get("patientName") || "";

  if (user?.role === "patient") {
    return (
      <div>
        <BookingWizard
          defaultDoctorId={doctorId}
          defaultType={type === "Follow-up" ? "Follow-up" : "Initial"}
        />
      </div>
    );
  }

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