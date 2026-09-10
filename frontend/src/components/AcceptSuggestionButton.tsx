import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { rescheduleAppointment } from "@/api/appointment";
import { getErrorMessage } from "@/lib/utils";

interface AcceptSuggestionButtonProps {
  appointmentId: string;
  suggestion: { date: string; timeSlot: string };
}

const formatLabel = (suggestion: { date: string; timeSlot: string }) =>
  `${new Date(`${suggestion.date}T12:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })} · ${suggestion.timeSlot}`;

export function AcceptSuggestionButton({
  appointmentId,
  suggestion,
}: AcceptSuggestionButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleAccept = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await rescheduleAppointment(appointmentId, {
        appointmentDate: suggestion.date,
        timeSlot: suggestion.timeSlot,
      });
      if (response.data.success) {
        toast.success("Appointment rescheduled");
        window.location.reload();
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "That slot is no longer free — pick another."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleAccept} disabled={busy}>
      {busy ? "Confirming…" : formatLabel(suggestion)}
    </Button>
  );
}