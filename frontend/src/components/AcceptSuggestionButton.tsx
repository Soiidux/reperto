import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { rescheduleAppointment } from "@/api/appointment";
import { getErrorMessage } from "@/lib/utils";

interface AcceptSuggestionButtonProps {
  appointmentId: string;
  suggestion: { date: string; timeSlot: string };
  /** Called after a successful reschedule so the list can refresh in place. */
  onRescheduled?: () => void;
}

const formatLabel = (suggestion: { date: string; timeSlot: string }) =>
  `${new Date(`${suggestion.date}T12:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })} · ${suggestion.timeSlot}`;

export function AcceptSuggestionButton({
  appointmentId,
  suggestion,
  onRescheduled,
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
        // Refetch in place instead of reloading the page: a full reload threw
        // away scroll position and all client state.
        onRescheduled?.();
      } else {
        // Previously a falsy success fell through with no feedback at all.
        toast.error(
          response.data.message || "Could not reschedule to that slot",
        );
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