import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  APPOINTMENT_STATUSES,
  STATUS_LABELS,
  type AppointmentStatus,
} from "@/lib/appointmentStatus";

interface AppointmentStatusControlProps {
  status: string;
  disabled?: boolean;
  /** Called with the chosen status. Cancelling asks for a reason first. */
  onChange: (status: AppointmentStatus, cancellationReason?: string) => void | Promise<void>;
}

/**
 * Front-desk status editor: staff can move a booking to any status. Choosing
 * "Cancelled" opens a small reason popover so the cancellation carries context.
 */
export function AppointmentStatusControl({
  status,
  disabled,
  onChange,
}: AppointmentStatusControlProps) {
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");

  const current = (APPOINTMENT_STATUSES as readonly string[]).includes(status)
    ? (status as AppointmentStatus)
    : "pending";

  const handleValueChange = (next: string) => {
    if (next === current) return;
    if (next === "cancelled") {
      setReason("");
      setReasonOpen(true);
      return;
    }
    void onChange(next as AppointmentStatus);
  };

  const submitCancellation = (event: FormEvent) => {
    event.preventDefault();
    setReasonOpen(false);
    void onChange("cancelled", reason.trim() || undefined);
  };

  return (
    <Popover open={reasonOpen} onOpenChange={setReasonOpen}>
      <PopoverAnchor asChild>
        <div className="inline-block">
          <Select value={current} onValueChange={handleValueChange} disabled={disabled}>
            <SelectTrigger size="sm" aria-label="Change appointment status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPOINTMENT_STATUSES.map((value) => (
                <SelectItem key={value} value={value} disabled={value === current}>
                  {STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverAnchor>
      <PopoverContent align="end">
        <PopoverHeader>
          <PopoverTitle>Cancel appointment</PopoverTitle>
          <PopoverDescription>
            Add a reason, then confirm. The patient will be notified.
          </PopoverDescription>
        </PopoverHeader>
        <form onSubmit={submitCancellation} className="flex flex-col gap-3">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="status-cancel-reason">Reason</FieldLabel>
              <Input
                id="status-cancel-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason for cancellation"
                autoFocus
              />
            </Field>
          </FieldGroup>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setReasonOpen(false)}>
              Keep status
            </Button>
            <Button type="submit" variant="destructive" size="sm">
              Cancel appointment
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}