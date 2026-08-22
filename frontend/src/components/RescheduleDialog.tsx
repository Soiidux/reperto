import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarIcon, Clock } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Field, FieldLabel } from "./ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { getAvailableSlots, rescheduleAppointment } from "@/api/appointment";
import { getErrorMessage } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

interface RescheduleDialogProps {
  appointmentId: string;
  doctorId: string;
  durationInMinutes: number;
  currentDate: string;
  currentTimeSlot: string;
  className?: string;
}

const formatDateLabel = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function RescheduleDialog({
  appointmentId,
  doctorId,
  durationInMinutes,
  currentDate,
  currentTimeSlot,
  className,
}: RescheduleDialogProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [slot, setSlot] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fetchToken = useRef(0);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const loadSlots = (selectedDate: string) => {
    const token = ++fetchToken.current;
    if (!selectedDate || !doctorId) {
      setSlots([]);
      return;
    }
    setIsSlotsLoading(true);
    getAvailableSlots(doctorId, selectedDate, String(durationInMinutes))
      .then((response) => {
        if (fetchToken.current !== token) return;
        const data = response.data?.data;
        setSlots(response.data?.success && Array.isArray(data) ? data : []);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (fetchToken.current !== token) return;
        setSlots([]);
        toast.error(getErrorMessage(error, "Failed to load available slots"));
      })
      .finally(() => {
        if (fetchToken.current === token) setIsSlotsLoading(false);
      });
  };

  const handleSelectDate = (selected: Date | undefined) => {
    if (!selected) return;
    const year = selected.getFullYear();
    const month = String(selected.getMonth() + 1).padStart(2, "0");
    const day = String(selected.getDate()).padStart(2, "0");
    const value = `${year}-${month}-${day}`;
    setDate(value);
    loadSlots(value);
  };

  const handleSubmit = async () => {
    if (!date || !slot) return;
    setIsSubmitting(true);
    try {
      const response = await rescheduleAppointment(appointmentId, {
        appointmentDate: date,
        timeSlot: slot,
      });
      if (response.data.success) {
        toast.success("Appointment rescheduled");
        setOpen(false);
        navigate(`/${user!.role}/dashboard`);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to reschedule appointment"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isUnchanged = date === "" || slot === "";

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setDate("");
          setSlot("");
          setSlots([]);
        }
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" className={className}>
          <CalendarIcon /> Reschedule
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Reschedule Appointment</SheetTitle>
          <SheetDescription>
            Currently {formatDateLabel(currentDate)} at {currentTimeSlot} ·{" "}
            {durationInMinutes} minutes
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-4">
          <Field>
            <FieldLabel htmlFor="reschedule-date">New Date</FieldLabel>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="reschedule-date"
                  type="button"
                  variant="outline"
                  className="w-full justify-start font-normal"
                >
                  <CalendarIcon />
                  {date ? formatDateLabel(date) : "Select new date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date ? new Date(`${date}T12:00:00`) : undefined}
                  defaultMonth={date ? new Date(`${date}T12:00:00`) : undefined}
                  captionLayout="dropdown"
                  onSelect={handleSelectDate}
                  disabled={(calendarDate) =>
                    calendarDate < new Date(new Date().setHours(0, 0, 0, 0))
                  }
                />
              </PopoverContent>
            </Popover>
          </Field>
          <Field>
            <FieldLabel htmlFor="reschedule-slot">
              New Time Slot ({durationInMinutes} min)
            </FieldLabel>
            <Select
              onValueChange={setSlot}
              value={slot}
              disabled={!date || isSlotsLoading || slots.length === 0}
            >
              <SelectTrigger id="reschedule-slot" className="w-full">
                <SelectValue
                  placeholder={
                    !date
                      ? "Pick a date first"
                      : isSlotsLoading
                        ? "Loading slots…"
                        : slots.length === 0
                          ? "No slots available"
                          : "Select time slot"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {slots.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {date && !isSlotsLoading && slots.length > 0 && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {slots.length} slot{slots.length === 1 ? "" : "s"} free on{" "}
                {formatDateLabel(date)}
              </p>
            )}
          </Field>
          <SheetFooter>
            <Button onClick={handleSubmit} disabled={isUnchanged || isSubmitting}>
              {isSubmitting ? "Rescheduling…" : "Confirm Reschedule"}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
